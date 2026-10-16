import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { gzipSync } from "node:zlib";
import { z } from "zod";

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
const defaultTolerance = { percent: 1, minBytes: 1024 };

const routeStatsSchema = z.array(
  z.object({ route: z.string(), firstLoadChunkPaths: z.array(z.string()) }),
);

const budgetSchema = z.object({
  tolerance: z.object({ percent: z.number(), minBytes: z.number() }),
  routes: z.record(z.string(), z.object({ firstLoadGzipBytes: z.number().int() })),
});

type Budget = z.infer<typeof budgetSchema>;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

if (!existsSync(statsPath)) {
  fail(
    `${statsPath} not found. Run bun run build first. If next build no longer writes this file, update scripts/check-bundle.ts to read the new one.`,
  );
}

const routeStats = routeStatsSchema.parse(JSON.parse(readFileSync(statsPath, "utf8")));
const gzipBytesByPath = new Map<string, number>();

function gzipBytesOf(chunkPath: string): number {
  const cached = gzipBytesByPath.get(chunkPath);

  if (cached !== undefined) return cached;

  const gzipBytes = gzipSync(readFileSync(join(buildRoot, chunkPath)), { level: 9 }).length;
  gzipBytesByPath.set(chunkPath, gzipBytes);

  return gzipBytes;
}

const firstLoadGzipBytesByRoute = new Map(
  routeStats.map(({ route, firstLoadChunkPaths }) => [
    route,
    firstLoadChunkPaths.reduce((total, chunkPath) => total + gzipBytesOf(chunkPath), 0),
  ]),
);

function readBudget(): Budget | null {
  if (!existsSync(budgetPath)) return null;

  return budgetSchema.parse(JSON.parse(readFileSync(budgetPath, "utf8")));
}

function writeBudget(previous: Budget | null): Budget {
  const routes = Object.fromEntries(
    [...firstLoadGzipBytesByRoute].map(([route, firstLoadGzipBytes]) => [
      route,
      { ...previous?.routes[route], firstLoadGzipBytes },
    ]),
  );

  const budget = { ...previous, tolerance: previous?.tolerance ?? defaultTolerance, routes };
  writeFileSync(budgetPath, `${JSON.stringify(budget, null, 2)}\n`);
  console.log(`Wrote ${budgetPath}`);

  return budget;
}

const budget = options.write ? writeBudget(readBudget()) : readBudget();

if (budget === null) fail(`${budgetPath} not found. Run bun run check:bundle --write.`);

const failures: string[] = [];

for (const route of Object.keys(budget.routes)) {
  if (!firstLoadGzipBytesByRoute.has(route)) {
    failures.push(`${route} is in the budget but not in route-bundle-stats.json`);
  }
}

console.log("route\tfirst-load gzip bytes\tbudget\tlimit");

for (const [route, gzipBytes] of firstLoadGzipBytesByRoute) {
  const routeBudget = budget.routes[route];

  if (routeBudget === undefined) {
    console.log(`${route}\t${gzipBytes}\tnone\tnone`);
    failures.push(`${route} has no budget. Add it with bun run check:bundle --write.`);
    continue;
  }

  const allowance = Math.max(
    Math.ceil((routeBudget.firstLoadGzipBytes * budget.tolerance.percent) / 100),
    budget.tolerance.minBytes,
  );

  const limit = routeBudget.firstLoadGzipBytes + allowance;
  console.log(`${route}\t${gzipBytes}\t${routeBudget.firstLoadGzipBytes}\t${limit}`);

  if (gzipBytes > limit) {
    failures.push(
      `${route} first-load JS is ${gzipBytes} B gzipped, over its limit of ${limit} B (budget ${routeBudget.firstLoadGzipBytes} B + ${allowance} B tolerance)`,
    );
  }
}

function prerenderedHtmlPath(route: string): string {
  const fileName = route === "/" ? "index.html" : `${route.slice(1)}.html`;

  return join(buildRoot, ".next", "server", "app", fileName);
}

const htmlOrigin = "http://localhost";

function preloadedScriptUrls(html: string): URL[] {
  return [...html.matchAll(/<link\b[^>]*>/g)].flatMap(([tag]) => {
    const relTokens = /\brel="([^"]*)"/.exec(tag)?.[1].split(/\s+/) ?? [];
    const href = /\bhref="([^"]*)"/.exec(tag)?.[1];
    const isPreload = relTokens.includes("preload") || relTokens.includes("modulepreload");

    if (!isPreload || href === undefined) return [];

    const url = new URL(href, htmlOrigin);

    return url.pathname.endsWith(".js") ? [url] : [];
  });
}

function extraPreloadProblem(firstLoadChunkPaths: string[], url: URL): string | null {
  if (url.origin !== htmlOrigin) return `${url.href}, a script from another origin`;

  const chunkPath = url.pathname.replace(/^\/_next\//, ".next/");

  if (firstLoadChunkPaths.includes(chunkPath)) return null;

  const size = existsSync(join(buildRoot, chunkPath))
    ? `${gzipBytesOf(chunkPath)} B gzipped`
    : "not in the build output";

  return `${chunkPath} (${size}), which is not in its first-load JS`;
}

for (const { route, firstLoadChunkPaths } of routeStats) {
  const htmlPath = prerenderedHtmlPath(route);

  if (!existsSync(htmlPath)) {
    failures.push(`${route} has no prerendered HTML at ${htmlPath}, so its preloads are unchecked`);
    continue;
  }

  for (const url of preloadedScriptUrls(readFileSync(htmlPath, "utf8"))) {
    const problem = extraPreloadProblem(firstLoadChunkPaths, url);

    if (problem !== null) failures.push(`${route} preloads ${problem}`);
  }
}

if (failures.length > 0) fail(`\n${failures.length} bundle problems:\n${failures.join("\n")}`);

console.log(`\n${routeStats.length} routes within budget, no extra preloaded JS`);
