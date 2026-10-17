import { execFileSync } from "node:child_process";
import { closeSync, mkdirSync, openSync, rmSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import {
  findFreePort,
  startServer,
  waitForServer,
  type Environment,
} from "@/shared/testing/perf/builds";
import { readPerfEnvironment } from "@/shared/testing/perf/environment";
import {
  buildHasKey,
  buildLogFile,
  buildStampFile,
  treeFingerprint,
  instanceFile,
  isAlive,
  readInstance,
  repoRoot,
  serverLogFile,
  verifyDirectory,
} from "@/shared/testing/verify/instance";

const { values: options, positionals } = parseArgs({
  allowPositionals: true,
  options: { "no-build": { type: "boolean", default: false } },
});

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function build(environment: Environment): void {
  const log = openSync(buildLogFile, "w");

  console.log(`building, log at ${buildLogFile}`);

  try {
    execFileSync(process.execPath, ["run", "build"], {
      cwd: repoRoot,
      env: environment,
      stdio: ["ignore", log, log],
    });
  } catch {
    fail(`bun run build failed. See ${buildLogFile}.`);
  } finally {
    closeSync(log);
  }

  writeFileSync(
    buildStampFile,
    JSON.stringify({ tree: treeFingerprint(), builtAt: new Date().toISOString() }),
  );
}

function prepare(): Environment {
  const existing = readInstance();

  if (existing && isAlive(existing.pid))
    fail(`A verify server already runs here: pid ${existing.pid} on port ${existing.port}.`);

  const perfEnvironment = readPerfEnvironment(repoRoot, process.env);

  if (perfEnvironment.kind === "refused") fail(`Refused: ${perfEnvironment.reason}`);

  const { environment } = perfEnvironment;
  const publishableKey = environment.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

  mkdirSync(verifyDirectory, { recursive: true });

  if (!options["no-build"]) build(environment);
  else if (!buildHasKey(publishableKey))
    fail(".next was not built with this worktree's .env.local. Run start without --no-build.");

  return environment;
}

async function start(): Promise<void> {
  const environment = prepare();
  const port = await findFreePort();
  const server = startServer(repoRoot, port, environment, serverLogFile);

  if (server.pid === undefined) fail("next start did not spawn.");

  writeFileSync(
    instanceFile,
    JSON.stringify({ pid: server.pid, port, startedAt: new Date().toISOString() }),
  );
  await waitForServer(server, port, serverLogFile);

  const signIn = await fetch(`http://localhost:${port}/sign-in`);

  if (!signIn.ok) fail(`/sign-in answered ${signIn.status}. See ${serverLogFile}.`);

  server.unref();
  console.log(`ready http://localhost:${port} pid ${server.pid}`);
}

async function stop(): Promise<void> {
  const instance = readInstance();

  if (!instance) return console.log("no verify server recorded in this worktree");

  if (isAlive(instance.pid)) process.kill(-instance.pid, "SIGTERM");

  const deadline = Date.now() + 10_000;

  while (isAlive(instance.pid) && Date.now() < deadline)
    await new Promise((resolve) => setTimeout(resolve, 200));

  if (isAlive(instance.pid)) process.kill(-instance.pid, "SIGKILL");

  rmSync(instanceFile);
  console.log(`stopped pid ${instance.pid}, port ${instance.port}`);
}

const command = positionals[0];

if (command === "start") await start();
else if (command === "stop") await stop();
else fail("usage: bun run verify:server start [--no-build] | stop");
