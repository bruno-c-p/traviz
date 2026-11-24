import { afterAll, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { gzipSync } from "node:zlib";
import { z } from "zod";

const checkBundleScript = join(import.meta.dir, "..", "..", "..", "scripts", "check-bundle.ts");
const fixtureRoots: string[] = [];

function noise(): string {
  return randomBytes(4000).toString("base64");
}

function moduleTag(chunk: string): string {
  return `<script type="module" src="/_astro/${chunk}.js"></script>`;
}

function lazyModuleTag(chunk: string): string {
  return `<script type="module" async src="/_astro/${chunk}.js" data-lazy-script="globe-engine"></script>`;
}

function lazyScriptTemplate(chunk: string): string {
  return `<template data-lazy-script="globe-engine" data-src="/_astro/${chunk}.js"></template>`;
}

function preloadTag(href: string): string {
  return `<link rel="preload" as="script" fetchpriority="low" href="${href}">`;
}

function page(...parts: string[]): string {
  return `<!DOCTYPE html><html><head><title>traviz</title></head><body>${parts.join("")}</body></html>`;
}

function chunkPath(fixtureRoot: string, chunk: string): string {
  return join(fixtureRoot, "dist", "client", "_astro", `${chunk}.js`);
}

function writeChunk(fixtureRoot: string, chunk: string, source: string = noise()) {
  writeFileSync(chunkPath(fixtureRoot, chunk), source);
}

function writePage(fixtureRoot: string, pageFile: string, html: string) {
  const pagePath = join(fixtureRoot, "pages", pageFile);

  mkdirSync(dirname(pagePath), { recursive: true });
  writeFileSync(pagePath, html);
}

function createBuildFixture(): string {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "check-bundle-"));

  fixtureRoots.push(fixtureRoot);
  mkdirSync(join(fixtureRoot, "dist", "client", "_astro"), { recursive: true });

  for (const chunk of ["home", "list", "lazy"]) writeChunk(fixtureRoot, chunk);

  writePage(fixtureRoot, "index.html", page(lazyModuleTag("home")));
  writePage(fixtureRoot, "list.html", page(moduleTag("list")));

  return fixtureRoot;
}

function gzipBytesOf(content: string | Buffer): number {
  return gzipSync(content, { level: 9 }).length;
}

function gzipBytesOfChunk(fixtureRoot: string, chunk: string): number {
  return gzipBytesOf(readFileSync(chunkPath(fixtureRoot, chunk)));
}

function sizesIn(output: string, route: string) {
  const cells = output
    .split("\n")
    .find((line) => line.startsWith(`${route}\t`))
    ?.split("\t");

  return { firstLoad: Number(cells?.[1]), lazy: Number(cells?.[4]), html: Number(cells?.[7]) };
}

function runCheckBundle(fixtureRoot: string, ...extraArguments: string[]) {
  const result = spawnSync(
    process.execPath,
    [
      checkBundleScript,
      "--root",
      fixtureRoot,
      "--pages",
      join(fixtureRoot, "pages"),
      "--budget",
      join(fixtureRoot, "bundle-budget.json"),
      ...extraArguments,
    ],
    { encoding: "utf8" },
  );

  return { exitCode: result.status, output: result.stdout + result.stderr };
}

function readBudget(fixtureRoot: string): string {
  return readFileSync(join(fixtureRoot, "bundle-budget.json"), "utf8");
}

const writtenBudgetSchema = z.object({
  tolerance: z.unknown(),
  routes: z.record(z.string(), z.unknown()),
});

function parsedBudget(fixtureRoot: string) {
  return writtenBudgetSchema.parse(JSON.parse(readBudget(fixtureRoot)));
}

function writeBudget(fixtureRoot: string, contents: string) {
  writeFileSync(join(fixtureRoot, "bundle-budget.json"), contents);
}

function expectFailure(fixtureRoot: string, expectedText: string, ...extraArguments: string[]) {
  const { exitCode, output } = runCheckBundle(fixtureRoot, ...extraArguments);

  expect(output).toContain(expectedText);
  expect(exitCode).toBe(1);
}

afterAll(() => {
  for (const fixtureRoot of fixtureRoots) rmSync(fixtureRoot, { recursive: true, force: true });
});

test("check:bundle --write records the budget, then the check passes", () => {
  const fixtureRoot = createBuildFixture();

  expect(runCheckBundle(fixtureRoot, "--write").exitCode).toBe(0);

  const { exitCode, output } = runCheckBundle(fixtureRoot);

  expect(output).toContain("2 routes within budget, no extra preloaded JS");
  expect(exitCode).toBe(0);
});

test("check:bundle --write records the first-load, lazy and HTML bytes of each route", () => {
  const fixtureRoot = createBuildFixture();

  writeChunk(fixtureRoot, "home", `${noise()};import("./lazy.js")`);
  runCheckBundle(fixtureRoot, "--write");

  const homeHtml = readFileSync(join(fixtureRoot, "pages", "index.html"));
  const listHtml = readFileSync(join(fixtureRoot, "pages", "list.html"));

  expect(JSON.parse(readBudget(fixtureRoot))).toEqual({
    tolerance: { percent: 1, minBytes: 1024 },
    routes: {
      "/": {
        firstLoadGzipBytes: gzipBytesOfChunk(fixtureRoot, "home"),
        lazyGzipBytes: gzipBytesOfChunk(fixtureRoot, "lazy"),
        htmlGzipBytes: gzipBytesOf(homeHtml),
      },
      "/list": {
        firstLoadGzipBytes: gzipBytesOfChunk(fixtureRoot, "list"),
        lazyGzipBytes: 0,
        htmlGzipBytes: gzipBytesOf(listHtml),
      },
    },
  });
});

test("check:bundle names a nested page by its path", () => {
  const fixtureRoot = createBuildFixture();

  writePage(fixtureRoot, "sign-in/verify.html", page(moduleTag("list")));
  runCheckBundle(fixtureRoot, "--write");

  expect(Object.keys(parsedBudget(fixtureRoot).routes)).toEqual(["/", "/list", "/sign-in/verify"]);
});

test("check:bundle allows growth within the 1 KB floor", () => {
  const fixtureRoot = createBuildFixture();

  runCheckBundle(fixtureRoot, "--write");
  writeChunk(
    fixtureRoot,
    "home",
    `${readFileSync(chunkPath(fixtureRoot, "home"), "utf8")}//${randomBytes(300).toString("base64")}`,
  );

  expect(runCheckBundle(fixtureRoot).exitCode).toBe(0);
});

test("check:bundle fails when a route's first-load JS grows past the tolerance", () => {
  const fixtureRoot = createBuildFixture();

  runCheckBundle(fixtureRoot, "--write");
  writeChunk(fixtureRoot, "home", noise() + noise());

  expectFailure(fixtureRoot, "/ first-load JS is");

  const { output } = runCheckBundle(fixtureRoot);

  expect(output).toContain("over its limit of");
  expect(output).not.toContain("/list first-load JS is");
});

test("check:bundle uses 1% as the tolerance once it is larger than the 1 KB floor", () => {
  const fixtureRoot = createBuildFixture();

  writeChunk(fixtureRoot, "home", randomBytes(200_000).toString("base64"));
  runCheckBundle(fixtureRoot, "--write");

  const budgeted = gzipBytesOfChunk(fixtureRoot, "home");

  expect(runCheckBundle(fixtureRoot).output).toContain(
    `/\t${budgeted}\t${budgeted}\t${budgeted + Math.ceil(budgeted / 100)}`,
  );
});

test("check:bundle counts an inline script, and not an inline data block, as first-load JS", () => {
  const fixtureRoot = createBuildFixture();
  const inlineSource = noise();

  writePage(
    fixtureRoot,
    "404.html",
    page(
      `<script type="text/plain" id="marks-snapshot">${noise()}</script>`,
      `<script type="application/json">${noise()}</script>`,
      `<script>${inlineSource}</script>`,
    ),
  );

  expect(sizesIn(runCheckBundle(fixtureRoot, "--write").output, "/404").firstLoad).toBe(
    gzipBytesOf(inlineSource),
  );
});

test("check:bundle gzips the inline scripts of a page together and adds its chunks", () => {
  const fixtureRoot = createBuildFixture();
  const [first, second] = [noise(), noise()];

  writePage(
    fixtureRoot,
    "list.html",
    page(
      `<script>${first}</script>`,
      `<script type="module">${second}</script>`,
      moduleTag("list"),
    ),
  );

  expect(sizesIn(runCheckBundle(fixtureRoot, "--write").output, "/list").firstLoad).toBe(
    gzipBytesOf(`${first}\n${second}`) + gzipBytesOfChunk(fixtureRoot, "list"),
  );
});

test("check:bundle counts a chunk that a loaded chunk imports statically as first-load JS", () => {
  const fixtureRoot = createBuildFixture();

  writeChunk(fixtureRoot, "shared");
  writeChunk(fixtureRoot, "list", `import{a}from"./shared.js";${noise()}`);

  const sizes = sizesIn(runCheckBundle(fixtureRoot, "--write").output, "/list");

  expect(sizes.firstLoad).toBe(
    gzipBytesOfChunk(fixtureRoot, "list") + gzipBytesOfChunk(fixtureRoot, "shared"),
  );
  expect(sizes.lazy).toBe(0);
});

test("check:bundle counts a chunk that an inline module imports statically as first-load JS", () => {
  const fixtureRoot = createBuildFixture();
  const inlineSource = 'import"/_astro/list.js";start()';

  writePage(fixtureRoot, "list.html", page(`<script type="module">${inlineSource}</script>`));

  expect(sizesIn(runCheckBundle(fixtureRoot, "--write").output, "/list").firstLoad).toBe(
    gzipBytesOf(inlineSource) + gzipBytesOfChunk(fixtureRoot, "list"),
  );
});

test("check:bundle counts a lazy chunk a first-load chunk references", () => {
  const fixtureRoot = createBuildFixture();

  writeChunk(fixtureRoot, "list", `${noise()};import("./lazy.js")`);

  expect(sizesIn(runCheckBundle(fixtureRoot, "--write").output, "/list").lazy).toBe(
    gzipBytesOfChunk(fixtureRoot, "lazy"),
  );
});

test("check:bundle counts a lazy chunk an inline script names", () => {
  const fixtureRoot = createBuildFixture();

  writePage(fixtureRoot, "404.html", page('<script>import("/_astro/lazy.js")</script>'));

  expect(sizesIn(runCheckBundle(fixtureRoot, "--write").output, "/404").lazy).toBe(
    gzipBytesOfChunk(fixtureRoot, "lazy"),
  );
});

test("check:bundle counts a script a template defers, and what it imports, as lazy JS", () => {
  const fixtureRoot = createBuildFixture();

  writeChunk(fixtureRoot, "engine", `import"./lazy.js";${noise()}`);
  writePage(fixtureRoot, "fragments/globe.html", page(lazyScriptTemplate("engine")));

  const sizes = sizesIn(runCheckBundle(fixtureRoot, "--write").output, "/fragments/globe");

  expect(sizes.firstLoad).toBe(0);
  expect(sizes.lazy).toBe(
    gzipBytesOfChunk(fixtureRoot, "engine") + gzipBytesOfChunk(fixtureRoot, "lazy"),
  );
});

test("check:bundle fails when a template defers a script that is not in the build output", () => {
  const fixtureRoot = createBuildFixture();

  writePage(fixtureRoot, "fragments/globe.html", page(lazyScriptTemplate("gone")));

  expectFailure(
    fixtureRoot,
    "/fragments/globe loads _astro/gone.js, which is not in the build",
    "--write",
  );
});

test("check:bundle fails when the globe engine is inlined into the page or dropped", () => {
  const fixtureRoot = createBuildFixture();

  runCheckBundle(fixtureRoot, "--write");
  writePage(fixtureRoot, "index.html", page(moduleTag("home")));
  expectFailure(fixtureRoot, "/ names no lazy script file");

  writePage(fixtureRoot, "index.html", page(lazyModuleTag("home")));
  writePage(fixtureRoot, "fragments/globe.html", page('<script type="module">engine()</script>'));
  expectFailure(fixtureRoot, "/fragments/globe names no lazy script file", "--write");
});

test("check:bundle counts a lazy chunk reached through another lazy chunk", () => {
  const fixtureRoot = createBuildFixture();

  writeChunk(fixtureRoot, "deep");
  writeChunk(fixtureRoot, "lazy", `${noise()};import("./deep.js")`);
  writeChunk(fixtureRoot, "list", `${noise()};import("./lazy.js")`);

  expect(sizesIn(runCheckBundle(fixtureRoot, "--write").output, "/list").lazy).toBe(
    gzipBytesOfChunk(fixtureRoot, "lazy") + gzipBytesOfChunk(fixtureRoot, "deep"),
  );
});

test("check:bundle does not count a first-load chunk as lazy when another chunk references it", () => {
  const fixtureRoot = createBuildFixture();

  writeChunk(fixtureRoot, "shared", `${noise()};import("./list.js")`);
  writeChunk(fixtureRoot, "list", `import{a}from"./shared.js";${noise()}`);

  expect(sizesIn(runCheckBundle(fixtureRoot, "--write").output, "/list").lazy).toBe(0);
});

test("check:bundle fails when a route's lazy JS grows past the tolerance and lists the chunks largest first", () => {
  const fixtureRoot = createBuildFixture();

  writeChunk(fixtureRoot, "small", randomBytes(100).toString("base64"));
  writeChunk(fixtureRoot, "list", `${noise()};import("./small.js");import("./lazy.js")`);
  runCheckBundle(fixtureRoot, "--write");
  writeChunk(fixtureRoot, "lazy", noise() + noise());

  const { exitCode, output } = runCheckBundle(fixtureRoot);

  expect(output).toMatch(/\/list lazy JS is \d+ B gzipped, over its limit of \d+ B/);
  expect(output).toMatch(/_astro\/lazy\.js \(\d+ B\), _astro\/small\.js \(\d+ B\)/);
  expect(exitCode).toBe(1);
});

test("check:bundle fails when a route's HTML grows past the tolerance", () => {
  const fixtureRoot = createBuildFixture();

  runCheckBundle(fixtureRoot, "--write");
  writePage(fixtureRoot, "list.html", page(`<style>${noise()}</style>`, moduleTag("list")));

  expectFailure(fixtureRoot, "/list HTML is");
});

test("check:bundle fails when the HTML preloads JS outside the route's first load", () => {
  const fixtureRoot = createBuildFixture();

  runCheckBundle(fixtureRoot, "--write");
  writePage(fixtureRoot, "list.html", page(preloadTag("/_astro/lazy.js"), moduleTag("list")));

  const { exitCode, output } = runCheckBundle(fixtureRoot);

  expect(output).toMatch(
    /\/list preloads _astro\/lazy\.js \(\d+ B gzipped\), which is not in its first-load JS/,
  );
  expect(exitCode).toBe(1);
});

test("check:bundle fails on a modulepreload outside the route's first load", () => {
  const fixtureRoot = createBuildFixture();

  runCheckBundle(fixtureRoot, "--write");
  writePage(
    fixtureRoot,
    "list.html",
    page('<link rel="modulepreload" href="/_astro/lazy.js">', moduleTag("list")),
  );

  expectFailure(fixtureRoot, "/list preloads _astro/lazy.js");
});

test("check:bundle fails when a route preloads a chunk only another route loads at first", () => {
  const fixtureRoot = createBuildFixture();

  runCheckBundle(fixtureRoot, "--write");
  writePage(fixtureRoot, "list.html", page(preloadTag("/_astro/home.js"), moduleTag("list")));

  expectFailure(fixtureRoot, "/list preloads _astro/home.js");
});

test("check:bundle allows a preload of a chunk the route loads at first", () => {
  const fixtureRoot = createBuildFixture();

  writePage(fixtureRoot, "list.html", page(preloadTag("/_astro/list.js"), moduleTag("list")));

  expect(runCheckBundle(fixtureRoot, "--write").exitCode).toBe(0);
});

test("check:bundle fails when the HTML preloads a script from another origin", () => {
  const fixtureRoot = createBuildFixture();

  runCheckBundle(fixtureRoot, "--write");
  writePage(
    fixtureRoot,
    "list.html",
    page(preloadTag("https://clerk.example.com/npm/@clerk/clerk-js@6/dist/clerk.browser.js")),
  );

  expectFailure(
    fixtureRoot,
    "/list preloads https://clerk.example.com/npm/@clerk/clerk-js@6/dist/clerk.browser.js, a script from another origin",
  );
});

test("check:bundle fails on a script preload whose URL has no .js extension", () => {
  const fixtureRoot = createBuildFixture();

  runCheckBundle(fixtureRoot, "--write");
  writePage(fixtureRoot, "list.html", page(preloadTag("/api/script"), moduleTag("list")));

  expectFailure(fixtureRoot, "/list preloads api/script (not in the build output)");
});

test("check:bundle fails when the HTML loads a chunk that is not in the build output", () => {
  const fixtureRoot = createBuildFixture();

  runCheckBundle(fixtureRoot, "--write");
  unlinkSync(chunkPath(fixtureRoot, "list"));

  expectFailure(fixtureRoot, "/list loads _astro/list.js, which is not in the build output");
});

test("check:bundle fails when a chunk imports a chunk that is not in the build output", () => {
  const fixtureRoot = createBuildFixture();

  runCheckBundle(fixtureRoot, "--write");
  writeChunk(fixtureRoot, "list", 'import"./gone.js";');

  expectFailure(fixtureRoot, "_astro/list.js imports _astro/gone.js, which is not in the build");
});

test("check:bundle never reads a chunk outside the client build", () => {
  const fixtureRoot = createBuildFixture();

  writeFileSync(join(fixtureRoot, "secret.js"), noise());
  writePage(fixtureRoot, "list.html", page('<script src="/../../secret.js"></script>'));

  expectFailure(fixtureRoot, "which is not in the build output", "--write");
});

test("check:bundle fails when the client build is missing", () => {
  const fixtureRoot = createBuildFixture();

  rmSync(join(fixtureRoot, "dist"), { recursive: true });

  expectFailure(fixtureRoot, "Run bun run build:node first.");
});

test("check:bundle fails when no page was rendered", () => {
  const fixtureRoot = createBuildFixture();

  rmSync(join(fixtureRoot, "pages"), { recursive: true });

  expectFailure(fixtureRoot, "No page was rendered");
});

test("check:bundle fails when a budgeted route is missing from the build", () => {
  const fixtureRoot = createBuildFixture();

  runCheckBundle(fixtureRoot, "--write");
  unlinkSync(join(fixtureRoot, "pages", "list.html"));

  expectFailure(fixtureRoot, "/list is in the budget but was not rendered");
});

test("check:bundle fails when a built route has no budget", () => {
  const fixtureRoot = createBuildFixture();

  runCheckBundle(fixtureRoot, "--write");
  writePage(fixtureRoot, "stats.html", page(moduleTag("list")));

  expectFailure(fixtureRoot, "/stats has no budget. Add it with bun run check:bundle --write.");
});

test("check:bundle fails when a page that needs its script runs no module script", () => {
  const fixtureRoot = createBuildFixture();

  runCheckBundle(fixtureRoot, "--write");
  writePage(fixtureRoot, "list.html", page("<script>theme()</script>"));

  expectFailure(fixtureRoot, "/list runs no module script");
  expectFailure(fixtureRoot, "Not writing a budget for a broken build", "--write");
});

test("check:bundle fails when the landing page's script was dropped from the build", () => {
  const fixtureRoot = createBuildFixture();

  writePage(fixtureRoot, "welcome.html", page("<script>theme()</script>"));

  expectFailure(fixtureRoot, "/welcome runs no module script", "--write");
});

test("check:bundle lets a page with no behaviour ship no module script", () => {
  const fixtureRoot = createBuildFixture();

  writePage(fixtureRoot, "404.html", page("<script>theme()</script>"));

  expect(runCheckBundle(fixtureRoot, "--write").exitCode).toBe(0);
});

test("check:bundle fails on a budget key it does not know", () => {
  const fixtureRoot = createBuildFixture();

  runCheckBundle(fixtureRoot, "--write");
  writeBudget(
    fixtureRoot,
    readBudget(fixtureRoot).replace('"minBytes": 1024', '"minBytes": 1024, "maxBytes": 1'),
  );

  expectFailure(fixtureRoot, "is invalid");
});

test("check:bundle fails on a budget from before HTML was budgeted", () => {
  const fixtureRoot = createBuildFixture();

  runCheckBundle(fixtureRoot, "--write");
  writeBudget(fixtureRoot, readBudget(fixtureRoot).replaceAll(/,\s*"htmlGzipBytes": \d+/g, ""));

  expectFailure(fixtureRoot, "htmlGzipBytes");
});

test("check:bundle points to a working recovery when the budget is invalid or not JSON", () => {
  const fixtureRoot = createBuildFixture();

  writeBudget(fixtureRoot, "{");
  expectFailure(
    fixtureRoot,
    "is not valid JSON. Fix it, or delete it and run bun run check:bundle --write.",
  );

  writeBudget(fixtureRoot, '{"routes": []}');
  expectFailure(
    fixtureRoot,
    "Fix it, or delete it and run bun run check:bundle --write.",
    "--write",
  );
});

test("check:bundle fails with a hint when there is no budget", () => {
  expectFailure(createBuildFixture(), "not found. Run bun run check:bundle --write.");
});

test("check:bundle --write keeps a hand-tuned tolerance", () => {
  const fixtureRoot = createBuildFixture();

  runCheckBundle(fixtureRoot, "--write");
  writeBudget(fixtureRoot, readBudget(fixtureRoot).replace('"minBytes": 1024', '"minBytes": 10'));
  runCheckBundle(fixtureRoot, "--write");

  expect(parsedBudget(fixtureRoot).tolerance).toEqual({ percent: 1, minBytes: 10 });
});

function productionStatic(fixtureRoot: string): string {
  const productionRoot = join(fixtureRoot, "production");

  cpSync(join(fixtureRoot, "dist", "client"), productionRoot, { recursive: true });

  return productionRoot;
}

test("check:bundle passes when the production build serves the same JS and prerendered HTML", () => {
  const fixtureRoot = createBuildFixture();

  mkdirSync(join(fixtureRoot, "dist", "client", "welcome"));
  writeFileSync(join(fixtureRoot, "dist", "client", "welcome", "index.html"), page());
  runCheckBundle(fixtureRoot, "--write");

  const { exitCode, output } = runCheckBundle(
    fixtureRoot,
    "--production-static",
    productionStatic(fixtureRoot),
  );

  expect(output).toContain("the production build serves the same JS and prerendered HTML");
  expect(exitCode).toBe(0);
});

test("check:bundle fails when the production build serves other JS than the measured build", () => {
  const fixtureRoot = createBuildFixture();

  runCheckBundle(fixtureRoot, "--write");

  const changed = productionStatic(fixtureRoot);

  writeFileSync(join(changed, "_astro", "home.js"), noise());
  expectFailure(fixtureRoot, "_astro/home.js differs between", "--production-static", changed);

  writeFileSync(join(changed, "_astro", "extra.js"), noise());
  expectFailure(fixtureRoot, "_astro/extra.js is in", "--production-static", changed);

  unlinkSync(join(changed, "_astro", "list.js"));
  expectFailure(
    fixtureRoot,
    "_astro/list.js is in the Node build but not in",
    "--production-static",
    changed,
  );

  expectFailure(
    fixtureRoot,
    "holds no JS or HTML. Run bun run build first.",
    "--production-static",
    join(fixtureRoot, "nowhere"),
  );
});
