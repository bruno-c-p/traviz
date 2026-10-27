import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const packageSchema = z.object({
  devEngines: z.object({ packageManager: z.object({ version: z.string() }) }),
});

export type Baseline = { label: string; sha: string; note: string };

export type BaselineResolution =
  | { kind: "resolved"; baseline: Baseline }
  | { kind: "refused"; reason: string };

function refused(reason: string): BaselineResolution {
  return { kind: "refused", reason };
}

function resolved(label: string, sha: string, note = ""): BaselineResolution {
  return { kind: "resolved", baseline: { label, sha, note } };
}

function commitCount(count: string): string {
  return count === "1" ? "1 commit" : `${count} commits`;
}

function git(root: string, args: string[]) {
  const result = spawnSync("git", ["-C", root, ...args], { encoding: "utf8" });

  return { status: result.status, stdout: result.stdout?.trim() ?? "" };
}

function resolveCommit(root: string, ref: string): string | undefined {
  const result = git(root, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);

  return result.status === 0 ? result.stdout : undefined;
}

export function resolveBaseline(root: string, baseRef: string): BaselineResolution {
  const localSha = resolveCommit(root, baseRef);

  if (localSha === undefined) return refused(`the baseline ${baseRef} is not a commit.`);

  const isRemoteBranch =
    git(root, ["show-ref", "--verify", "--quiet", `refs/remotes/${baseRef}`]).status === 0;

  if (isRemoteBranch) {
    const remote = baseRef.split("/")[0];

    if (git(root, ["fetch", "--quiet", remote]).status !== 0)
      return refused(`git fetch ${remote} failed, so ${baseRef} may be stale.`);

    return resolved(baseRef, resolveCommit(root, baseRef) ?? localSha);
  }

  const isLocalBranch =
    git(root, ["show-ref", "--verify", "--quiet", `refs/heads/${baseRef}`]).status === 0;

  const upstream = isLocalBranch
    ? git(root, ["rev-parse", "--abbrev-ref", `${baseRef}@{upstream}`]).stdout
    : "";

  if (upstream === "") return resolved(baseRef, localSha);

  const remote = git(root, ["config", `branch.${baseRef}.remote`]).stdout;

  if (git(root, ["fetch", "--quiet", remote]).status !== 0)
    return refused(
      `git fetch ${remote} failed, so ${baseRef} cannot be checked against ${upstream}.`,
    );

  const upstreamSha = resolveCommit(root, upstream);

  if (upstreamSha === undefined) return refused(`${upstream} does not exist after git fetch.`);

  const [ahead = "0", behind = "0"] = git(root, [
    "rev-list",
    "--left-right",
    "--count",
    `${localSha}...${upstreamSha}`,
  ]).stdout.split(/\s+/);

  if (ahead !== "0")
    return refused(
      `local ${baseRef} has ${commitCount(ahead)} that ${upstream} lacks. Pass --baseline ${upstream} or the exact commit to measure.`,
    );

  if (behind === "0") return resolved(baseRef, localSha);

  return resolved(
    upstream,
    upstreamSha,
    `local ${baseRef} is ${commitCount(behind)} behind ${upstream}, so the baseline is ${upstream} at ${upstreamSha}.`,
  );
}

export type LockfilePolicy = "same-as-baseline" | "may-differ";

export function findGuardFailures(
  root: string,
  baseline: Baseline,
  bunVersion: string,
  lockfilePolicy: LockfilePolicy = "same-as-baseline",
): string[] {
  const failures: string[] = [];

  const pinnedBunVersion = packageSchema.parse(
    JSON.parse(readFileSync(join(root, "package.json"), "utf8")),
  ).devEngines.packageManager.version;

  if (bunVersion !== pinnedBunVersion)
    failures.push(
      `bun is ${bunVersion}, but devEngines pins ${pinnedBunVersion}. Run bunx bun@${pinnedBunVersion} run perf.`,
    );

  const status = spawnSync("git", ["-C", root, "status", "--porcelain"], { encoding: "utf8" });
  const dirtyPaths = status.stdout?.trimEnd() ?? "";

  if (status.status !== 0) failures.push("git status failed, so the tree cannot be checked.");
  else if (dirtyPaths !== "")
    failures.push(`the working tree is dirty, so the build would not match HEAD:\n${dirtyPaths}`);

  const lockfileDiff = git(root, ["diff", "--quiet", baseline.sha, "HEAD", "--", "bun.lock"]);

  if (lockfileDiff.status !== 0 && lockfileDiff.status !== 1)
    failures.push(`git diff could not compare bun.lock with ${baseline.label}.`);

  if (lockfileDiff.status === 1 && lockfilePolicy === "same-as-baseline")
    failures.push(
      `bun.lock differs from ${baseline.label}, so the two builds would measure different dependencies. Pass --allow-lockfile-diff when the dependency change is what you measure.`,
    );

  return failures;
}
