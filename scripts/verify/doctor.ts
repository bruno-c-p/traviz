import { execFileSync } from "node:child_process";
import { readPerfEnvironment } from "@/shared/testing/perf/environment";
import { findSeededUserId, seededUserEmail } from "@/shared/testing/clerk-dev";
import { launchBrowser, readMarkRows } from "@/shared/testing/verify/browser";
import {
  buildHasPublicValues,
  treeFingerprint,
  isAlive,
  readBuildStamp,
  readInstance,
  repoRoot,
} from "@/shared/testing/verify/instance";

type Check = { name: string; failure: string | undefined };

const checks: Check[] = [];

function check(name: string, failure: string | undefined): void {
  checks.push({ name, failure });
}

function run(command: string, args: string[]): string {
  try {
    return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return "";
  }
}

const perfEnvironment = readPerfEnvironment(repoRoot, process.env);

check(
  ".env.local is local only (file: database in .data, pk_test_ Clerk key, Mapbox token)",
  perfEnvironment.kind === "refused" ? perfEnvironment.reason : undefined,
);

for (const tool of ["sqlite3", "clerk"])
  check(`${tool} is on PATH`, run("which", [tool]) === "" ? `install ${tool}` : undefined);

function failureOf(probe: () => boolean): string | undefined {
  try {
    return probe() ? undefined : "not found. Run bun run setup";
  } catch (cause: unknown) {
    return cause instanceof Error ? cause.message : String(cause);
  }
}

check(
  `the clerk CLI is logged in and the dev user ${seededUserEmail} exists`,
  failureOf(() => findSeededUserId() !== undefined),
);

check(
  "the worktree database has a marks table",
  failureOf(() => readMarkRows().length >= 0),
);

check(
  ".next was built with this worktree's Clerk key and Mapbox token, not bun run check's placeholders",
  perfEnvironment.kind === "ready" && buildHasPublicValues(perfEnvironment.environment)
    ? undefined
    : "run bun run verify:server stop, then bun run verify:server start",
);

const stamp = readBuildStamp();

check(
  "the build matches HEAD plus the working tree's changes",
  stamp?.tree === treeFingerprint()
    ? undefined
    : `source changed since the build at ${stamp?.builtAt ?? "never"}. Run bun run verify:server stop, then bun run verify:server start`,
);

const instance = readInstance();
const isRunning = instance !== undefined && isAlive(instance.pid);

check(
  "the verify server recorded in .data/verify/server.json is alive",
  isRunning ? undefined : "run bun run verify:server start",
);

if (instance && isRunning) {
  const listeners = run("lsof", ["-nP", `-iTCP:${instance.port}`, "-sTCP:LISTEN", "-t"])
    .split("\n")
    .filter((pid) => pid !== "");

  const groups = listeners.map((pid) => run("ps", ["-o", "pgid=", "-p", pid]).trim());

  check(
    `port ${instance.port} is held by our process group ${instance.pid}`,
    listeners.length > 0 && groups.every((group) => group === String(instance.pid))
      ? undefined
      : `listeners ${listeners.join(",") || "none"} in groups ${groups.join(",") || "none"}`,
  );

  const signIn = await fetch(`http://localhost:${instance.port}/sign-in`).catch(() => undefined);

  check(
    `GET /sign-in answers 200 on port ${instance.port}`,
    signIn?.ok ? undefined : `got ${signIn?.status ?? "no answer"}`,
  );
}

const browser = await launchBrowser().catch(() => undefined);

check(
  "Google Chrome launches through playwright-core",
  browser ? undefined : "install Google Chrome",
);

await browser?.close();

for (const { name, failure } of checks)
  console.log(failure ? `FAIL ${name}: ${failure}` : `ok   ${name}`);

if (checks.some(({ failure }) => failure)) process.exit(1);
