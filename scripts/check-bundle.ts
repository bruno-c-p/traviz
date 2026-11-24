import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { parseArgs } from "node:util";
import { z } from "zod";
import { homePath, listPath, statsPath, welcomePath } from "@/paths";
import { pageRoutes, renderRoutes } from "@/shared/testing/bundle/render-routes";
import { measureRoute, type RouteBundle } from "@/shared/testing/bundle/route-bundle";

const { values: options } = parseArgs({
  options: {
    root: { type: "string" },
    budget: { type: "string" },
    pages: { type: "string" },
    "production-static": { type: "string" },
    write: { type: "boolean", default: false },
  },
});

const repoRoot = join(import.meta.dirname, "..");
const buildRoot = resolve(options.root ?? repoRoot);
const clientRoot = join(buildRoot, "dist", "client");
const budgetPath = resolve(options.budget ?? join(repoRoot, "bundle-budget.json"));
const buildHint = "Run bun run build:node first.";
const defaultTolerance = { percent: 1, minBytes: 1024 };

const routesWithModuleScript: string[] = [homePath(), listPath(), statsPath(), welcomePath()];

const sizeFields = ["firstLoadGzipBytes", "lazyGzipBytes", "htmlGzipBytes"] as const;

const sizeNames: Record<(typeof sizeFields)[number], string> = {
  firstLoadGzipBytes: "first-load JS",
  lazyGzipBytes: "lazy JS",
  htmlGzipBytes: "HTML",
};

const budgetSchema = z.strictObject({
  tolerance: z.strictObject({ percent: z.number(), minBytes: z.number() }),
  routes: z.record(
    z.string(),
    z.strictObject({
      firstLoadGzipBytes: z.number().int(),
      lazyGzipBytes: z.number().int(),
      htmlGzipBytes: z.number().int(),
    }),
  ),
});

type Budget = z.infer<typeof budgetSchema>;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function filesUnder(directory: string, extensions: readonly string[]): string[] {
  if (!existsSync(directory)) return [];

  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && extensions.some((ending) => entry.name.endsWith(ending)))
    .map((entry) => relative(directory, join(entry.parentPath, entry.name)).split(sep).join("/"))
    .toSorted();
}

function routeOfPageFile(pageFile: string): string {
  const name = pageFile.replace(/\.html$/, "");

  return name === "index" ? "/" : `/${name}`;
}

function readPagesDirectory(pagesDirectory: string): Map<string, string> {
  return new Map(
    filesUnder(pagesDirectory, [".html"]).map((pageFile) => [
      routeOfPageFile(pageFile),
      readFileSync(join(pagesDirectory, pageFile), "utf8"),
    ]),
  );
}

async function renderedPages(): Promise<Map<string, string>> {
  if (options.pages !== undefined) return readPagesDirectory(resolve(options.pages));

  return renderRoutes(buildRoot, pageRoutes()).catch((cause: unknown) =>
    fail(cause instanceof Error ? cause.message : String(cause)),
  );
}

if (!existsSync(clientRoot)) fail(`${clientRoot} not found. ${buildHint}`);

const chunkSources = new Map<string, string | null>();

function readChunk(chunkPath: string): string | null {
  const known = chunkSources.get(chunkPath);

  if (known !== undefined) return known;

  const absolutePath = resolve(clientRoot, chunkPath);
  const isInside = absolutePath.startsWith(clientRoot + sep);
  const source = isInside && existsSync(absolutePath) ? readFileSync(absolutePath, "utf8") : null;

  chunkSources.set(chunkPath, source);

  return source;
}

const pages = await renderedPages();

if (pages.size === 0) fail(`No page was rendered from ${buildRoot}. ${buildHint}`);

const bundles = new Map<string, RouteBundle>(
  [...pages].map(([route, html]) => [route, measureRoute(html, readChunk)]),
);

function readBudget(): Budget | null {
  if (!existsSync(budgetPath)) return null;

  const recovery = "Fix it, or delete it and run bun run check:bundle --write.";
  let json: unknown;

  try {
    json = JSON.parse(readFileSync(budgetPath, "utf8"));
  } catch {
    fail(`${budgetPath} is not valid JSON. ${recovery}`);
  }

  const parsed = budgetSchema.safeParse(json);

  if (!parsed.success)
    fail(`${budgetPath} is invalid. ${recovery}\n${z.prettifyError(parsed.error)}`);

  return parsed.data;
}

function writeBudget(previous: Budget | null): Budget {
  const routes = Object.fromEntries(
    [...bundles].map(([route, bundle]) => [
      route,
      {
        firstLoadGzipBytes: bundle.firstLoadGzipBytes,
        lazyGzipBytes: bundle.lazyGzipBytes,
        htmlGzipBytes: bundle.htmlGzipBytes,
      },
    ]),
  );

  const budget = { tolerance: previous?.tolerance ?? defaultTolerance, routes };

  writeFileSync(budgetPath, `${JSON.stringify(budget, null, 2)}\n`);
  console.log(`Wrote ${budgetPath}`);

  return budget;
}

const failures: string[] = [];

for (const [route, bundle] of bundles) {
  for (const problem of bundle.problems) failures.push(`${route} ${problem}`);

  if (routesWithModuleScript.includes(route) && !bundle.hasModuleScript)
    failures.push(
      `${route} runs no module script. A script that only imports for side effects is dropped unless package.json lists its entry in sideEffects.`,
    );
}

function differingFiles(productionRoot: string): string[] {
  const extensions = [".js", ".mjs", ".html"];
  const local = filesUnder(clientRoot, extensions);
  const production = filesUnder(productionRoot, extensions);

  if (production.length === 0)
    return [`${productionRoot} holds no JS or HTML. Run bun run build first.`];

  return [...new Set([...local, ...production])].flatMap((file) => {
    const localPath = join(clientRoot, file);
    const productionPath = join(productionRoot, file);

    if (!existsSync(localPath))
      return [`${file} is in ${productionRoot} but not in the Node build, so it is unbudgeted`];

    if (!existsSync(productionPath))
      return [`${file} is in the Node build but not in ${productionRoot}`];

    return readFileSync(localPath).equals(readFileSync(productionPath))
      ? []
      : [`${file} differs between the Node build and ${productionRoot}`];
  });
}

if (options["production-static"] !== undefined)
  failures.push(...differingFiles(resolve(options["production-static"])));

if (options.write && failures.length > 0)
  fail(`\nNot writing a budget for a broken build:\n${failures.join("\n")}`);

const budget = options.write ? writeBudget(readBudget()) : readBudget();

if (budget === null) fail(`${budgetPath} not found. Run bun run check:bundle --write.`);

for (const route of Object.keys(budget.routes)) {
  if (!bundles.has(route)) failures.push(`${route} is in the budget but was not rendered`);
}

function limitOf(budgetBytes: number, tolerance: Budget["tolerance"]) {
  const allowance = Math.max(
    Math.ceil((budgetBytes * tolerance.percent) / 100),
    tolerance.minBytes,
  );

  return { allowance, limit: budgetBytes + allowance };
}

console.log(
  [
    "route",
    "first-load gzip bytes",
    "budget",
    "limit",
    "lazy gzip bytes",
    "lazy budget",
    "lazy limit",
    "html gzip bytes",
    "html budget",
    "html limit",
  ].join("\t"),
);

for (const [route, bundle] of bundles) {
  const routeBudget = budget.routes[route];

  if (routeBudget === undefined) {
    console.log(
      [route, ...sizeFields.flatMap((field) => [bundle[field], "none", "none"])].join("\t"),
    );
    failures.push(`${route} has no budget. Add it with bun run check:bundle --write.`);
    continue;
  }

  console.log(
    [
      route,
      ...sizeFields.flatMap((field) => [
        bundle[field],
        routeBudget[field],
        limitOf(routeBudget[field], budget.tolerance).limit,
      ]),
    ].join("\t"),
  );

  for (const field of sizeFields) {
    const { allowance, limit } = limitOf(routeBudget[field], budget.tolerance);

    if (bundle[field] <= limit) continue;

    const lazyChunks =
      field === "lazyGzipBytes"
        ? `: ${bundle.lazyChunks.map((chunk) => `${chunk.chunkPath} (${chunk.gzipBytes} B)`).join(", ")}`
        : "";

    failures.push(
      `${route} ${sizeNames[field]} is ${bundle[field]} B gzipped, over its limit of ${limit} B (budget ${routeBudget[field]} B + ${allowance} B tolerance)${lazyChunks}`,
    );
  }
}

if (failures.length > 0) fail(`\n${failures.length} bundle problems:\n${failures.join("\n")}`);

console.log(
  `\n${bundles.size} routes within budget, no extra preloaded JS${options["production-static"] === undefined ? "" : ", and the production build serves the same JS and prerendered HTML"}`,
);
