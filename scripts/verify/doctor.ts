import { execFileSync } from "node:child_process";
import { readPerfEnvironment, withSignInMode } from "@/shared/testing/perf/environment";
import { findSeededUserId, seededUserEmail } from "@/shared/testing/clerk-dev";
import { launchBrowser, markTableExists } from "@/shared/testing/verify/browser";
import {
  buildMatchesEnvironment,
  treeFingerprint,
  isAlive,
  readBuildStamp,
  readInstance,
  repoRoot,
} from "@/shared/testing/verify/instance";
import { listPath, signInPath } from "@/paths";

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
  ".env.local is local only (file: database in .data, no live Clerk key)",
  perfEnvironment.kind === "refused" ? perfEnvironment.reason : undefined,
);

async function failureOf(probe: () => boolean | Promise<boolean>): Promise<string | undefined> {
  try {
    return (await probe()) ? undefined : "not found. Run bun run setup";
  } catch (cause: unknown) {
    return cause instanceof Error ? cause.message : String(cause);
  }
}

const stamp = readBuildStamp();
const signInMode = stamp?.signIn ?? "clerk";

if (signInMode === "clerk")
  check(
    `Clerk's development instance answers and the dev user ${seededUserEmail} exists`,
    await failureOf(async () => (await Promise.resolve(findSeededUserId())) !== undefined),
  );
else check("the build signs every request in as the fixed local user, without Clerk", undefined);

check("the worktree database has a marks table", await failureOf(markTableExists));

check(
  `dist is a Node adapter build for ${signInMode} sign-in with this worktree's .env.local, not bun run check's placeholders`,
  perfEnvironment.kind === "ready" &&
    buildMatchesEnvironment(withSignInMode(perfEnvironment.environment, signInMode))
    ? undefined
    : "run bun run verify:server stop, then bun run verify:server start",
);

check(
  "the build matches HEAD plus the working tree's changes",
  stamp?.tree === treeFingerprint()
    ? undefined
    : `source changed since the build at ${stamp?.builtAt ?? "never"}. Run bun run verify:server stop, then bun run verify:server start`,
);

let instance: ReturnType<typeof readInstance>;
let recordFailure: string | undefined;

try {
  instance = readInstance();
} catch (cause: unknown) {
  recordFailure = cause instanceof Error ? cause.message : String(cause);
}

check(".data/verify/server.json is readable", recordFailure);

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

  const probePath = instance.signIn === "clerk" ? signInPath() : listPath();

  const probe = await fetch(`http://127.0.0.1:${instance.port}${probePath}`, {
    redirect: "manual",
  }).catch(() => undefined);

  check(
    `GET ${probePath} answers 200 on port ${instance.port}`,
    probe?.status === 200 ? undefined : `got ${probe?.status ?? "no answer"}`,
  );

  check(
    "the running server uses the sign-in mode of the last build",
    instance.signIn === signInMode
      ? undefined
      : `the server signs in with ${instance.signIn}, the build with ${signInMode}. Run bun run verify:server stop, then start`,
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
