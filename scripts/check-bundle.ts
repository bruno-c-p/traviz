import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { gzipSync } from "node:zlib";
import { z } from "zod";
import { welcomePath } from "@/paths";

const { values: options } = parseArgs({
  options: {
    root: { type: "string" },
    budget: { type: "string" },
    write: { type: "boolean", default: false },
  },
});

const repoRoot = join(import.meta.dirname, "..");
const buildRoot = resolve(options.root ?? repoRoot);
const budgetPath = resolve(options.budget ?? join(repoRoot, "bundle-budget.json"));
const statsPath = join(buildRoot, ".next", "diagnostics", "route-bundle-stats.json");
const statsChangedHint = `If next build no longer writes ${statsPath} in this shape, update scripts/check-bundle.ts.`;
const defaultTolerance = { percent: 1, minBytes: 1024 };
const htmlOrigin = "http://localhost";

const landingPages = [
  { route: welcomePath(), htmlPath: join("public", welcomePath(), "index.html") },
].filter(({ htmlPath }) => existsSync(join(buildRoot, htmlPath)));

const routeStatsSchema = z
  .array(z.object({ route: z.string(), firstLoadChunkPaths: z.array(z.string()).min(1) }))
  .min(1);

const budgetSchema = z.strictObject({
  tolerance: z.strictObject({ percent: z.number(), minBytes: z.number() }),
  routes: z.record(
    z.string(),
    z.strictObject({ firstLoadGzipBytes: z.number().int(), lazyGzipBytes: z.number().int() }),
  ),
});

type Budget = z.infer<typeof budgetSchema>;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

if (!existsSync(statsPath))
  fail(`${statsPath} not found. Run bun run build first. ${statsChangedHint}`);

function readJson<T>(path: string, schema: z.ZodType<T>, problem: string): T {
  const text = readFileSync(path, "utf8");
  let json: unknown;

  try {
    json = JSON.parse(text);
  } catch {
    fail(`${path} is not valid JSON. ${problem}`);
  }

  const parsed = schema.safeParse(json);

  if (!parsed.success) fail(`${path} is invalid. ${problem}\n${z.prettifyError(parsed.error)}`);

  return parsed.data;
}

const nextRouteStats = readJson(
  statsPath,
  routeStatsSchema,
  `It should be a list of routes with first-load chunks. ${statsChangedHint}`,
);

function staticImportPaths(chunkPath: string): string[] {
  const source = readFileSync(join(buildRoot, chunkPath), "utf8");

  return [...source.matchAll(/(?:from|import)\s*["'`]\.\/([\w.-]+\.js)["'`]/g)].flatMap(
    ([, fileName]) => (fileName === undefined ? [] : [join(dirname(chunkPath), fileName)]),
  );
}

function withStaticImports(entryChunkPaths: string[]): string[] {
  const reached = new Set(entryChunkPaths);
  const pending = [...entryChunkPaths];

  for (let chunkPath = pending.pop(); chunkPath !== undefined; chunkPath = pending.pop()) {
    for (const imported of staticImportPaths(chunkPath)) {
      if (reached.has(imported)) continue;

      reached.add(imported);
      pending.push(imported);
    }
  }

  return [...reached];
}

function landingFirstLoadChunkPaths(htmlPath: string): string[] {
  const html = readFileSync(join(buildRoot, htmlPath), "utf8");

  const entryChunkPaths = loadedScriptUrls(html).flatMap((url) => {
    const chunkPath = localChunkPath(url);

    if (chunkPath === null) return [];

    if (!existsSync(join(buildRoot, chunkPath)))
      fail(`${htmlPath} loads ${chunkPath}, which is not on disk. Run bun run build first.`);

    return [chunkPath];
  });

  if (entryChunkPaths.length === 0)
    fail(
      `${htmlPath} loads no script. A script that only imports for side effects is dropped unless package.json lists it in sideEffects.`,
    );

  return withStaticImports(entryChunkPaths);
}

const routeStats = [
  ...nextRouteStats,
  ...landingPages.map(({ route, htmlPath }) => ({
    route,
    firstLoadChunkPaths: landingFirstLoadChunkPaths(htmlPath),
  })),
];

const gzipBytesByPath = new Map<string, number>();

function gzipBytesOf(chunkPath: string): number {
  const cached = gzipBytesByPath.get(chunkPath);

  if (cached !== undefined) return cached;

  const absolutePath = join(buildRoot, chunkPath);

  if (!existsSync(absolutePath))
    fail(`${chunkPath} is in route-bundle-stats.json but not on disk. ${statsChangedHint}`);

  const gzipBytes = gzipSync(readFileSync(absolutePath), { level: 9 }).length;
  gzipBytesByPath.set(chunkPath, gzipBytes);

  return gzipBytes;
}

const firstLoadGzipBytesByRoute = new Map(
  routeStats.map(({ route, firstLoadChunkPaths }) => [
    route,
    firstLoadChunkPaths.reduce((total, chunkPath) => total + gzipBytesOf(chunkPath), 0),
  ]),
);

const referencedChunkPathsByPath = new Map<string, string[]>();

function siblingChunkPaths(chunkPath: string, source: string): string[] {
  const fileNames = new Set([...source.matchAll(/[\w.-]+\.js/g)].map(([fileName]) => fileName));

  return [...fileNames].flatMap((fileName) => {
    const siblingPath = join(dirname(chunkPath), fileName);
    const isSibling = siblingPath !== chunkPath && existsSync(join(buildRoot, siblingPath));

    return isSibling ? [siblingPath] : [];
  });
}

function referencedChunkPaths(chunkPath: string): string[] {
  const cached = referencedChunkPathsByPath.get(chunkPath);

  if (cached !== undefined) return cached;

  const source = readFileSync(join(buildRoot, chunkPath), "utf8");

  const references = chunkPath.startsWith(".next/")
    ? [...source.matchAll(/static\/chunks\/[\w.-]+\.js/g)].map(([reference]) => {
        const referencePath = `.next/${reference}`;

        if (!existsSync(join(buildRoot, referencePath)))
          fail(
            `${chunkPath} references ${referencePath}, which is not on disk. ${statsChangedHint}`,
          );

        return referencePath;
      })
    : siblingChunkPaths(chunkPath, source);

  referencedChunkPathsByPath.set(chunkPath, references);

  return references;
}

function lazyChunkPathsOf(firstLoadChunkPaths: string[]): string[] {
  const reached = new Set(firstLoadChunkPaths);
  const lazyChunkPaths: string[] = [];
  const pending = [...firstLoadChunkPaths];

  for (let chunkPath = pending.pop(); chunkPath !== undefined; chunkPath = pending.pop()) {
    for (const reference of referencedChunkPaths(chunkPath)) {
      if (reached.has(reference)) continue;

      reached.add(reference);
      lazyChunkPaths.push(reference);
      pending.push(reference);
    }
  }

  return lazyChunkPaths.toSorted((left, right) => gzipBytesOf(right) - gzipBytesOf(left));
}

const lazyChunkPathsByRoute = new Map(
  routeStats.map(({ route, firstLoadChunkPaths }) => [
    route,
    lazyChunkPathsOf(firstLoadChunkPaths),
  ]),
);

const lazyGzipBytesByRoute = new Map(
  [...lazyChunkPathsByRoute].map(([route, lazyChunkPaths]) => [
    route,
    lazyChunkPaths.reduce((total, chunkPath) => total + gzipBytesOf(chunkPath), 0),
  ]),
);

function readBudget(): Budget | null {
  if (!existsSync(budgetPath)) return null;

  return readJson(
    budgetPath,
    budgetSchema,
    "Fix it, or delete it and run bun run check:bundle --write.",
  );
}

function writeBudget(previous: Budget | null): Budget {
  const routes = Object.fromEntries(
    [...firstLoadGzipBytesByRoute].map(([route, firstLoadGzipBytes]) => [
      route,
      { firstLoadGzipBytes, lazyGzipBytes: lazyGzipBytesByRoute.get(route) ?? 0 },
    ]),
  );

  const budget = { tolerance: previous?.tolerance ?? defaultTolerance, routes };
  writeFileSync(budgetPath, `${JSON.stringify(budget, null, 2)}\n`);
  console.log(`Wrote ${budgetPath}`);

  return budget;
}

const budget = options.write ? writeBudget(readBudget()) : readBudget();

if (budget === null) fail(`${budgetPath} not found. Run bun run check:bundle --write.`);

const failures: string[] = [];

for (const route of Object.keys(budget.routes)) {
  if (!firstLoadGzipBytesByRoute.has(route)) {
    failures.push(
      `${route} is in the budget but not in route-bundle-stats.json or the landing build`,
    );
  }
}

function limitOf(budgetBytes: number, tolerance: Budget["tolerance"]) {
  const allowance = Math.max(
    Math.ceil((budgetBytes * tolerance.percent) / 100),
    tolerance.minBytes,
  );

  return { allowance, limit: budgetBytes + allowance };
}

console.log(
  "route\tfirst-load gzip bytes\tbudget\tlimit\tlazy gzip bytes\tlazy budget\tlazy limit",
);

for (const [route, gzipBytes] of firstLoadGzipBytesByRoute) {
  const routeBudget = budget.routes[route];
  const lazyGzipBytes = lazyGzipBytesByRoute.get(route) ?? 0;

  if (routeBudget === undefined) {
    console.log(`${route}\t${gzipBytes}\tnone\tnone\t${lazyGzipBytes}\tnone\tnone`);
    failures.push(`${route} has no budget. Add it with bun run check:bundle --write.`);
    continue;
  }

  const { allowance, limit } = limitOf(routeBudget.firstLoadGzipBytes, budget.tolerance);
  const lazy = limitOf(routeBudget.lazyGzipBytes, budget.tolerance);

  console.log(
    `${route}\t${gzipBytes}\t${routeBudget.firstLoadGzipBytes}\t${limit}\t${lazyGzipBytes}\t${routeBudget.lazyGzipBytes}\t${lazy.limit}`,
  );

  if (gzipBytes > limit) {
    failures.push(
      `${route} first-load JS is ${gzipBytes} B gzipped, over its limit of ${limit} B (budget ${routeBudget.firstLoadGzipBytes} B + ${allowance} B tolerance)`,
    );
  }

  if (lazyGzipBytes > lazy.limit) {
    const lazyChunks = (lazyChunkPathsByRoute.get(route) ?? [])
      .map((chunkPath) => `${chunkPath} (${gzipBytesOf(chunkPath)} B)`)
      .join(", ");

    failures.push(
      `${route} lazy JS is ${lazyGzipBytes} B gzipped, over its limit of ${lazy.limit} B (budget ${routeBudget.lazyGzipBytes} B + ${lazy.allowance} B tolerance): ${lazyChunks}`,
    );
  }
}

function prerenderedHtmlPath(route: string): string {
  const landingPage = landingPages.find((page) => page.route === route);

  if (landingPage) return join(buildRoot, landingPage.htmlPath);

  const fileName = route === "/" ? "index.html" : `${route.slice(1)}.html`;

  return join(buildRoot, ".next", "server", "app", fileName);
}

function attributeOf(tag: string, name: string): string | undefined {
  return new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
}

function tagsIn(html: string, element: string): string[] {
  return [...html.matchAll(new RegExp(`<${element}\\s[^>]*>`, "g"))].map(([tag]) => tag);
}

function preloadedScriptUrls(html: string): URL[] {
  return tagsIn(html, "link").flatMap((tag) => {
    const relTokens = attributeOf(tag, "rel")?.split(/\s+/) ?? [];
    const href = attributeOf(tag, "href");

    const isScriptPreload =
      relTokens.includes("modulepreload") ||
      (relTokens.includes("preload") && attributeOf(tag, "as") === "script");

    return isScriptPreload && href !== undefined ? [new URL(href, htmlOrigin)] : [];
  });
}

function loadedScriptUrls(html: string): URL[] {
  return tagsIn(html, "script").flatMap((tag) => {
    const src = attributeOf(tag, "src");

    return src !== undefined && !/\snoModule\b/i.test(tag) ? [new URL(src, htmlOrigin)] : [];
  });
}

function localChunkPath(url: URL): string | null {
  if (url.origin !== htmlOrigin) return null;

  return url.pathname.startsWith("/_next/")
    ? url.pathname.replace(/^\/_next\//, ".next/")
    : join("public", url.pathname);
}

function extraPreloadProblem(firstLoadChunkPaths: string[], url: URL): string | null {
  const chunkPath = localChunkPath(url);

  if (chunkPath === null) return `${url.href}, a script from another origin`;

  if (firstLoadChunkPaths.includes(chunkPath)) return null;

  const size = existsSync(join(buildRoot, chunkPath))
    ? `${gzipBytesOf(chunkPath)} B gzipped`
    : "not in the build output";

  return `${chunkPath} (${size}), which is not in its first-load JS`;
}

for (const { route, firstLoadChunkPaths } of routeStats) {
  const htmlPath = prerenderedHtmlPath(route);

  if (!existsSync(htmlPath)) {
    failures.push(`${route} has no prerendered HTML at ${htmlPath}, so its scripts are unchecked`);
    continue;
  }

  const html = readFileSync(htmlPath, "utf8");

  for (const url of loadedScriptUrls(html)) {
    const chunkPath = localChunkPath(url);

    if (chunkPath !== null && !firstLoadChunkPaths.includes(chunkPath)) {
      const hint = chunkPath.startsWith(".next/static/") ? ` ${statsChangedHint}` : "";

      failures.push(
        `${route} HTML loads ${chunkPath}, which route-bundle-stats.json leaves out of its first-load JS.${hint}`,
      );
    }
  }

  for (const url of preloadedScriptUrls(html)) {
    const problem = extraPreloadProblem(firstLoadChunkPaths, url);

    if (problem !== null) failures.push(`${route} preloads ${problem}`);
  }
}

if (failures.length > 0) fail(`\n${failures.length} bundle problems:\n${failures.join("\n")}`);

console.log(`\n${routeStats.length} routes within budget, no extra preloaded JS`);
