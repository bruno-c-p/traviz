import { afterAll, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, rmSync } from "node:fs";
import { join, relative } from "node:path";
import { exportTree } from "@/shared/testing/perf/builds";

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
