import { afterAll, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import {
  buildEnvironment,
  commitKind,
  exportTree,
  serverCommand,
  treeKind,
} from "@/shared/testing/perf/builds";

const repoRoot = join(import.meta.dir, "..", "..", "..", "..");
const treeDirectory = join(repoRoot, ".data", `perf-export-test-${process.pid}`);

afterAll(() => {
  rmSync(treeDirectory, { recursive: true, force: true });
});

function git(args: string[]): string {
  return execFileSync("git", ["-C", repoRoot, ...args], { encoding: "utf8" }).trim();
}

function listFiles(directory: string): string[] {
  return readdirSync(directory, { recursive: true, withFileTypes: true }).flatMap((entry) =>
    entry.isFile() || entry.isSymbolicLink()
      ? [relative(directory, join(entry.parentPath, entry.name))]
      : [],
  );
}

test("exports exactly the files of a commit without touching the repo's index", () => {
  const sha = git(["rev-parse", "HEAD"]);
  const indexPath = git(["rev-parse", "--path-format=absolute", "--git-path", "index"]);
  const indexBefore = readFileSync(indexPath);

  exportTree(repoRoot, sha, treeDirectory);

  expect(listFiles(treeDirectory).toSorted()).toEqual(
    git(["ls-tree", "-r", "--name-only", sha]).split("\n").toSorted(),
  );
  expect(readFileSync(join(treeDirectory, "package.json"), "utf8").trim()).toBe(
    git(["show", `${sha}:package.json`]),
  );
  expect(readFileSync(indexPath)).toEqual(indexBefore);
});

test("a tree with next.config.ts is a Next tree, and any other tree is an Astro tree", () => {
  const nextTree = join(treeDirectory, "kinds", "next");
  const astroTree = join(treeDirectory, "kinds", "astro");

  mkdirSync(nextTree, { recursive: true });
  mkdirSync(astroTree, { recursive: true });
  writeFileSync(join(nextTree, "next.config.ts"), "");
  writeFileSync(join(nextTree, "astro.config.ts"), "");
  writeFileSync(join(astroTree, "astro.config.ts"), "");

  expect(treeKind(nextTree)).toBe("next");
  expect(treeKind(astroTree)).toBe("astro");
});

test("HEAD is an Astro commit", () => {
  expect(commitKind(repoRoot, git(["rev-parse", "HEAD"]))).toBe("astro");
});

test("an Astro tree builds with the Node adapter and runs its own server entry", () => {
  const environment = { TURSO_DATABASE_URL: "file:/tmp/perf.db" };

  expect(buildEnvironment("astro", environment)).toEqual({
    ...environment,
    TRAVIZ_ADAPTER: "node",
  });
  expect(serverCommand("astro", "/trees/abc", 4100, environment)).toEqual({
    command: "node",
    args: ["/trees/abc/dist/server/entry.mjs"],
    environment: { ...environment, HOST: "127.0.0.1", PORT: "4100" },
  });
});

test("a Next tree builds as it is and runs next start on the port", () => {
  const environment = { TURSO_DATABASE_URL: "file:/tmp/perf.db" };

  expect(buildEnvironment("next", environment)).toBe(environment);
  expect(serverCommand("next", "/trees/abc", 4100, environment)).toEqual({
    command: "/trees/abc/node_modules/.bin/next",
    args: ["start", "--port", "4100"],
    environment,
  });
});
