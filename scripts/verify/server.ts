import { execFileSync } from "node:child_process";
import { closeSync, mkdirSync, openSync, rmSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import {
  findFreePort,
  startServer,
  stopServer,
  waitForServer,
  type Environment,
} from "@/shared/testing/perf/builds";
import { readPerfEnvironment } from "@/shared/testing/perf/environment";
import {
  buildHasPublicValues,
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

function readRecord(): ReturnType<typeof readInstance> {
  try {
    return readInstance();
  } catch (cause: unknown) {
    return fail(cause instanceof Error ? cause.message : String(cause));
  }
}

function build(environment: Environment): void {
  const tree = treeFingerprint();
  const log = openSync(buildLogFile, "w");

  rmSync(buildStampFile, { force: true });

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

  writeFileSync(buildStampFile, JSON.stringify({ tree, builtAt: new Date().toISOString() }));
}

function prepare(): Environment {
  const existing = readRecord();

  if (existing && isAlive(existing.pid))
    fail(
      `A verify server already runs here: pid ${existing.pid} on port ${existing.port}. Run bun run verify:server stop first.`,
    );

  const perfEnvironment = readPerfEnvironment(repoRoot, process.env);

  if (perfEnvironment.kind === "refused") fail(`Refused: ${perfEnvironment.reason}`);

  const { environment } = perfEnvironment;

  mkdirSync(verifyDirectory, { recursive: true });

  if (!options["no-build"]) build(environment);
  else if (!buildHasPublicValues(environment))
    fail(".next was not built with this worktree's .env.local. Run start without --no-build.");

  return environment;
}

async function waitUntilReady(port: number): Promise<void> {
  const signIn = await fetch(`http://localhost:${port}/sign-in`);

  if (!signIn.ok) throw new Error(`/sign-in answered ${signIn.status}. See ${serverLogFile}.`);
}

async function start(): Promise<void> {
  const environment = prepare();
  const port = await findFreePort();
  const server = startServer(repoRoot, port, environment, serverLogFile);

  const stopOnSignal = () => {
    stopServer(server);
    fail("Interrupted before the server was ready. It was stopped.");
  };

  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM", "SIGHUP"];

  for (const signal of signals) process.once(signal, stopOnSignal);

  try {
    await waitForServer(server, port, serverLogFile);
    await waitUntilReady(port);
  } catch (cause: unknown) {
    stopServer(server);
    fail(`The server did not become ready and was stopped. ${String(cause)}`);
  }

  writeFileSync(
    instanceFile,
    JSON.stringify({ pid: server.pid, port, startedAt: new Date().toISOString() }),
  );

  for (const signal of signals) process.off(signal, stopOnSignal);

  server.unref();
  console.log(`ready http://localhost:${port} pid ${server.pid}`);
}

function signalGroup(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-pid, signal);
  } catch (cause: unknown) {
    if (!(cause instanceof Error && "code" in cause && cause.code === "ESRCH")) throw cause;
  }
}

async function stop(): Promise<void> {
  const instance = readRecord();

  if (!instance) return console.log("no verify server recorded in this worktree");

  try {
    if (isAlive(instance.pid)) signalGroup(instance.pid, "SIGTERM");

    const deadline = Date.now() + 10_000;

    while (isAlive(instance.pid) && Date.now() < deadline)
      await new Promise((resolve) => setTimeout(resolve, 200));

    if (isAlive(instance.pid)) signalGroup(instance.pid, "SIGKILL");
  } finally {
    rmSync(instanceFile, { force: true });
  }

  console.log(`stopped pid ${instance.pid}, port ${instance.port}`);
}

const command = positionals[0];

if (command === "start") await start();
else if (command === "stop") await stop();
else fail("usage: bun run verify:server start [--no-build] | stop");
