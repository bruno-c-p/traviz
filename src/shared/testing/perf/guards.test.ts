import { afterAll, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { findGuardFailures, resolveBaseline } from "@/shared/testing/perf/guards";

const pinnedBunVersion = "1.4.3";
const fixturesDirectory = join(import.meta.dir, "..", "..", "..", "..", ".data");
const fixtureRoots: string[] = [];

const fixtureGitEnvironment = {
  ...process.env,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_SYSTEM: "/dev/null",
  GIT_AUTHOR_NAME: "perf fixture",
  GIT_AUTHOR_EMAIL: "perf-fixture@example.com",
  GIT_COMMITTER_NAME: "perf fixture",
  GIT_COMMITTER_EMAIL: "perf-fixture@example.com",
};

afterAll(() => {
  for (const fixtureRoot of fixtureRoots) rmSync(fixtureRoot, { recursive: true, force: true });
});

function git(fixtureRoot: string, args: string[]): void {
  execFileSync("git", args, { cwd: fixtureRoot, env: fixtureGitEnvironment, stdio: "ignore" });
}

function commitAll(fixtureRoot: string, message: string): void {
  git(fixtureRoot, ["add", "."]);
  git(fixtureRoot, ["commit", "--quiet", "-m", message]);
}

function createFixture(): string {
  mkdirSync(fixturesDirectory, { recursive: true });

  const fixtureRoot = mkdtempSync(join(fixturesDirectory, "perf-guards-"));

  fixtureRoots.push(fixtureRoot);
  git(fixtureRoot, ["init", "--quiet", "--initial-branch", "main"]);
  writeFileSync(
    join(fixtureRoot, "package.json"),
    JSON.stringify({ devEngines: { packageManager: { name: "bun", version: pinnedBunVersion } } }),
  );
  writeFileSync(join(fixtureRoot, "bun.lock"), '{ "lockfileVersion": 1 }\n');
  commitAll(fixtureRoot, "base");
  git(fixtureRoot, ["switch", "--quiet", "-c", "feature"]);
  writeFileSync(join(fixtureRoot, "feature.ts"), "export const feature = 1;\n");
  commitAll(fixtureRoot, "feature");

  return fixtureRoot;
}

function guardFailures(fixtureRoot: string, baseRef: string, bunVersion: string): string[] {
  const resolution = resolveBaseline(fixtureRoot, baseRef);

  if (resolution.kind === "refused") return [resolution.reason];

  return findGuardFailures(fixtureRoot, resolution.baseline, bunVersion);
}

function revParse(fixtureRoot: string, ref: string): string {
  return execFileSync("git", ["rev-parse", ref], { cwd: fixtureRoot, encoding: "utf8" }).trim();
}

function cloneFixture(upstreamRoot: string): string {
  const cloneRoot = mkdtempSync(join(fixturesDirectory, "perf-clone-"));

  fixtureRoots.push(cloneRoot);
  git(cloneRoot, ["clone", "--quiet", upstreamRoot, "."]);
  git(cloneRoot, ["switch", "--quiet", "main"]);
  git(cloneRoot, ["switch", "--quiet", "feature"]);

  return cloneRoot;
}

function advanceMain(fixtureRoot: string, fileName: string): void {
  git(fixtureRoot, ["switch", "--quiet", "main"]);
  writeFileSync(join(fixtureRoot, fileName), "export const later = 1;\n");
  commitAll(fixtureRoot, `add ${fileName}`);
  git(fixtureRoot, ["switch", "--quiet", "feature"]);
}

test("a clean tree with the base's lockfile and the pinned bun passes", () => {
  expect(guardFailures(createFixture(), "main", pinnedBunVersion)).toEqual([]);
});

test("refuses a dirty tree", () => {
  const fixtureRoot = createFixture();

  writeFileSync(join(fixtureRoot, "feature.ts"), "export const feature = 2;\n");

  expect(guardFailures(fixtureRoot, "main", pinnedBunVersion)).toEqual([
    "the working tree is dirty, so the build would not match HEAD:\n M feature.ts",
  ]);
});

test("refuses an untracked file", () => {
  const fixtureRoot = createFixture();

  writeFileSync(join(fixtureRoot, "scratch.ts"), "");

  expect(guardFailures(fixtureRoot, "main", pinnedBunVersion)).toEqual([
    "the working tree is dirty, so the build would not match HEAD:\n?? scratch.ts",
  ]);
});

test("refuses a committed lockfile that differs from the base", () => {
  const fixtureRoot = createFixture();

  writeFileSync(join(fixtureRoot, "bun.lock"), '{ "lockfileVersion": 1, "bumped": true }\n');
  commitAll(fixtureRoot, "bump a dependency");

  expect(guardFailures(fixtureRoot, "main", pinnedBunVersion)).toEqual([
    "bun.lock differs from main, so the two builds would measure different dependencies.",
  ]);
});

test("refuses a bun version other than the devEngines pin", () => {
  expect(guardFailures(createFixture(), "main", "1.3.14")).toEqual([
    `bun is 1.3.14, but devEngines pins ${pinnedBunVersion}. Run bunx bun@${pinnedBunVersion} run perf.`,
  ]);
});

test("refuses a baseline that is not a commit", () => {
  expect(guardFailures(createFixture(), "no-such-branch", pinnedBunVersion)).toEqual([
    "the baseline no-such-branch is not a commit.",
  ]);
});

test("measures the upstream when local main is behind it", () => {
  const upstreamRoot = createFixture();
  const cloneRoot = cloneFixture(upstreamRoot);

  advanceMain(upstreamRoot, "later.ts");

  const staleSha = revParse(cloneRoot, "main");
  const resolution = resolveBaseline(cloneRoot, "main");
  const upstreamSha = revParse(upstreamRoot, "main");

  expect(resolution).toEqual({
    kind: "resolved",
    baseline: {
      label: "origin/main",
      sha: upstreamSha,
      note: `local main is 1 commit behind origin/main, so the baseline is origin/main at ${upstreamSha}.`,
    },
  });
  expect(upstreamSha).not.toBe(staleSha);
});

test("keeps local main when it matches its upstream", () => {
  const cloneRoot = cloneFixture(createFixture());

  expect(resolveBaseline(cloneRoot, "main")).toEqual({
    kind: "resolved",
    baseline: { label: "main", sha: revParse(cloneRoot, "main"), note: "" },
  });
});

test("refuses local main with commits its upstream lacks", () => {
  const upstreamRoot = createFixture();
  const cloneRoot = cloneFixture(upstreamRoot);

  advanceMain(upstreamRoot, "upstream.ts");
  advanceMain(cloneRoot, "local.ts");

  expect(guardFailures(cloneRoot, "main", pinnedBunVersion)).toEqual([
    "local main has 1 commit that origin/main lacks. Pass --baseline origin/main or the exact commit to measure.",
  ]);
});

test("fetches a remote-tracking baseline before measuring it", () => {
  const upstreamRoot = createFixture();
  const cloneRoot = cloneFixture(upstreamRoot);

  advanceMain(upstreamRoot, "later.ts");

  expect(resolveBaseline(cloneRoot, "origin/main")).toEqual({
    kind: "resolved",
    baseline: { label: "origin/main", sha: revParse(upstreamRoot, "main"), note: "" },
  });
});
