import { afterAll, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const checkBundleScript = join(import.meta.dir, "..", "..", "scripts", "check-bundle.ts");
const fixtureRoots: string[] = [];

const firstLoadChunks = {
  "/": [".next/static/chunks/shared.js", ".next/static/chunks/home.js"],
  "/list": [".next/static/chunks/shared.js", ".next/static/chunks/list.js"],
};

function preloadTag(href: string): string {
  return `<link rel="preload" as="script" fetchPriority="low" href="${href}"/>`;
}

function writeRouteStats(fixtureRoot: string, routes: string[]) {
  const routeStats = Object.entries(firstLoadChunks)
    .filter(([route]) => routes.includes(route))
    .map(([route, firstLoadChunkPaths]) => ({
      route,
      firstLoadUncompressedJsBytes: 0,
      firstLoadChunkPaths,
    }));

  writeFileSync(
    join(fixtureRoot, ".next", "diagnostics", "route-bundle-stats.json"),
    JSON.stringify(routeStats),
  );
}

function createBuildFixture(): string {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "check-bundle-"));
  fixtureRoots.push(fixtureRoot);

  for (const directory of ["diagnostics", "static/chunks", "server/app"]) {
    mkdirSync(join(fixtureRoot, ".next", directory), { recursive: true });
  }

  for (const chunk of ["shared", "home", "list", "lazy"]) {
    writeFileSync(join(fixtureRoot, ".next", "static", "chunks", `${chunk}.js`), randomBytes(4000));
  }

  writeRouteStats(fixtureRoot, ["/", "/list"]);
  writeFileSync(
    join(fixtureRoot, ".next", "server", "app", "index.html"),
    [
      preloadTag("/_next/static/chunks/home.js"),
      '<script src="/_next/static/chunks/shared.js" async="">',
      '<script src="/_next/static/chunks/lazy.js" noModule="">',
      '<script src="https://clerk.example.com/npm/@clerk/clerk-js@6/dist/clerk.browser.js" async="">',
    ].join(""),
  );
  writeFileSync(join(fixtureRoot, ".next", "server", "app", "list.html"), "<html></html>");

  return fixtureRoot;
}

function writeListHtml(fixtureRoot: string, html: string) {
  writeFileSync(join(fixtureRoot, ".next", "server", "app", "list.html"), html);
}

function runCheckBundle(fixtureRoot: string, ...extraArguments: string[]) {
  const result = spawnSync(
    process.execPath,
    [
      checkBundleScript,
      "--root",
      fixtureRoot,
      "--budget",
      join(fixtureRoot, "bundle-budget.json"),
      ...extraArguments,
    ],
    { encoding: "utf8" },
  );

  return { exitCode: result.status, output: result.stdout + result.stderr };
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

test("check:bundle allows growth within the 1 KB floor", () => {
  const fixtureRoot = createBuildFixture();
  runCheckBundle(fixtureRoot, "--write");
  appendFileSync(join(fixtureRoot, ".next", "static", "chunks", "home.js"), randomBytes(500));

  expect(runCheckBundle(fixtureRoot).exitCode).toBe(0);
});

test("check:bundle fails when a route's first-load JS grows past the tolerance", () => {
  const fixtureRoot = createBuildFixture();
  runCheckBundle(fixtureRoot, "--write");
  appendFileSync(join(fixtureRoot, ".next", "static", "chunks", "home.js"), randomBytes(2000));

  const { exitCode, output } = runCheckBundle(fixtureRoot);

  expect(output).toMatch(/^\/ first-load JS is \d+ B gzipped, over its limit/m);
  expect(output).not.toMatch(/^\/list first-load JS/m);
  expect(exitCode).toBe(1);
});

test("check:bundle fails when the HTML preloads JS outside the route's first load", () => {
  const fixtureRoot = createBuildFixture();
  runCheckBundle(fixtureRoot, "--write");
  writeListHtml(fixtureRoot, preloadTag("/_next/static/chunks/lazy.js?dpl=abc"));

  const { exitCode, output } = runCheckBundle(fixtureRoot);

  expect(output).toMatch(
    /^\/list preloads \.next\/static\/chunks\/lazy\.js \(\d+ B gzipped\), which is not in its first-load JS$/m,
  );
  expect(exitCode).toBe(1);
});

test("check:bundle fails when the HTML preloads a script from another origin", () => {
  const fixtureRoot = createBuildFixture();
  runCheckBundle(fixtureRoot, "--write");
  writeListHtml(
    fixtureRoot,
    preloadTag("https://clerk.example.com/npm/@clerk/ui@1/dist/ui.browser.js"),
  );

  const { exitCode, output } = runCheckBundle(fixtureRoot);

  expect(output).toContain(
    "/list preloads https://clerk.example.com/npm/@clerk/ui@1/dist/ui.browser.js, a script from another origin",
  );
  expect(exitCode).toBe(1);
});

test("check:bundle fails when the stats file is missing", () => {
  const fixtureRoot = createBuildFixture();
  rmSync(join(fixtureRoot, ".next", "diagnostics"), { recursive: true });

  const { exitCode, output } = runCheckBundle(fixtureRoot);

  expect(output).toContain("route-bundle-stats.json not found");
  expect(exitCode).toBe(1);
});

test("check:bundle fails when a budgeted route is missing from the build", () => {
  const fixtureRoot = createBuildFixture();
  runCheckBundle(fixtureRoot, "--write");
  writeRouteStats(fixtureRoot, ["/"]);

  const { exitCode, output } = runCheckBundle(fixtureRoot);

  expect(output).toContain("/list is in the budget but not in route-bundle-stats.json");
  expect(exitCode).toBe(1);
});

test("check:bundle fails when a built route has no budget", () => {
  const fixtureRoot = createBuildFixture();
  writeRouteStats(fixtureRoot, ["/"]);
  runCheckBundle(fixtureRoot, "--write");
  writeRouteStats(fixtureRoot, ["/", "/list"]);

  const { exitCode, output } = runCheckBundle(fixtureRoot);

  expect(output).toContain("/list has no budget");
  expect(exitCode).toBe(1);
});

test("check:bundle fails on a modulepreload outside the route's first load", () => {
  const fixtureRoot = createBuildFixture();
  runCheckBundle(fixtureRoot, "--write");
  writeListHtml(fixtureRoot, '<link rel="modulepreload" href="/_next/static/chunks/lazy.js"/>');

  const { exitCode, output } = runCheckBundle(fixtureRoot);

  expect(output).toContain("/list preloads .next/static/chunks/lazy.js");
  expect(exitCode).toBe(1);
});

test("check:bundle fails when the HTML loads a chunk the stats file leaves out", () => {
  const fixtureRoot = createBuildFixture();
  runCheckBundle(fixtureRoot, "--write");
  writeListHtml(fixtureRoot, '<script src="/_next/static/chunks/lazy.js" async="">');

  const { exitCode, output } = runCheckBundle(fixtureRoot);

  expect(output).toContain(
    "/list HTML loads .next/static/chunks/lazy.js, which route-bundle-stats.json leaves out of its first-load JS",
  );
  expect(exitCode).toBe(1);
});

test("check:bundle fails when a route has no prerendered HTML", () => {
  const fixtureRoot = createBuildFixture();
  runCheckBundle(fixtureRoot, "--write");
  rmSync(join(fixtureRoot, ".next", "server", "app", "list.html"));

  const { exitCode, output } = runCheckBundle(fixtureRoot);

  expect(output).toContain("/list has no prerendered HTML");
  expect(exitCode).toBe(1);
});

test("check:bundle fails when the stats file lists no routes", () => {
  const fixtureRoot = createBuildFixture();
  runCheckBundle(fixtureRoot, "--write");
  writeRouteStats(fixtureRoot, []);

  const { exitCode, output } = runCheckBundle(fixtureRoot);

  expect(output).toContain("is not a list of routes with first-load chunks");
  expect(exitCode).toBe(1);
});

test("check:bundle fails on a budget key it does not know", () => {
  const fixtureRoot = createBuildFixture();
  writeFileSync(
    join(fixtureRoot, "bundle-budget.json"),
    JSON.stringify({
      tolerance: { percent: 1, minBytes: 1024 },
      routes: { "/": { firstLoadGzipBytes: 1, scriptOrigin: [] } },
    }),
  );

  const { exitCode, output } = runCheckBundle(fixtureRoot);

  expect(output).toContain("bundle-budget.json is invalid");
  expect(exitCode).toBe(1);
});

test("check:bundle fails on a script preload whose URL has no .js extension", () => {
  const fixtureRoot = createBuildFixture();
  runCheckBundle(fixtureRoot, "--write");
  writeListHtml(fixtureRoot, preloadTag("https://www.googletagmanager.com/gtag/js?id=G-1"));

  const { exitCode, output } = runCheckBundle(fixtureRoot);

  expect(output).toContain("/list preloads https://www.googletagmanager.com/gtag/js?id=G-1");
  expect(exitCode).toBe(1);
});
