import { execFileSync, spawn, spawnSync, type ChildProcess } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { z } from "zod";

export type Environment = NodeJS.ProcessEnv;

export type TreeKind = "astro" | "next";

export type ServerCommand = {
  readonly command: string;
  readonly args: readonly string[];
  readonly environment: Environment;
};

export function treeKind(treeDirectory: string): TreeKind {
  return existsSync(join(treeDirectory, "next.config.ts")) ? "next" : "astro";
}

export function commitKind(root: string, sha: string): TreeKind {
  const lookup = spawnSync("git", ["-C", root, "cat-file", "-e", `${sha}:next.config.ts`]);

  return lookup.status === 0 ? "next" : "astro";
}

export function buildEnvironment(kind: TreeKind, environment: Environment): Environment {
  return kind === "astro" ? { ...environment, TRAVIZ_ADAPTER: "node" } : environment;
}

export function serverCommand(
  kind: TreeKind,
  treeDirectory: string,
  port: number,
  environment: Environment,
): ServerCommand {
  if (kind === "next")
    return {
      command: join(treeDirectory, "node_modules", ".bin", "next"),
      args: ["start", "--port", String(port)],
      environment,
    };

  return {
    command: "node",
    args: [join(treeDirectory, "dist", "server", "entry.mjs")],
    environment: { ...environment, HOST: "127.0.0.1", PORT: String(port) },
  };
}

export function exportTree(root: string, sha: string, treeDirectory: string): void {
  rmSync(treeDirectory, { recursive: true, force: true });
  mkdirSync(treeDirectory, { recursive: true });

  const indexFile = join(treeDirectory, ".perf-index");
  const gitEnvironment = { ...process.env, GIT_INDEX_FILE: indexFile };

  execFileSync("git", ["-C", root, "read-tree", sha], { env: gitEnvironment });
  execFileSync("git", ["-C", root, "checkout-index", "--all", `--prefix=${treeDirectory}/`], {
    env: gitEnvironment,
  });
  rmSync(indexFile);
}

export function buildTree(
  root: string,
  sha: string,
  treeDirectory: string,
  environment: Environment,
  logPath: string,
): void {
  exportTree(root, sha, treeDirectory);

  const log = openSync(logPath, "w");

  try {
    for (const args of [
      ["install", "--frozen-lockfile"],
      ["run", "build"],
    ])
      execFileSync(process.execPath, args, {
        cwd: treeDirectory,
        env: buildEnvironment(treeKind(treeDirectory), environment),
        stdio: ["ignore", log, log],
      });
  } catch (cause: unknown) {
    throw new Error(`Building ${sha} failed. See ${logPath}.`, { cause });
  } finally {
    closeSync(log);
  }
}

export function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = z.object({ port: z.number() }).parse(server.address());

      server.close(() => resolve(port));
    });
  });
}

export function startServer(
  treeDirectory: string,
  port: number,
  environment: Environment,
  logPath: string,
): ChildProcess {
  const log = openSync(logPath, "w");
  const start = serverCommand(treeKind(treeDirectory), treeDirectory, port, environment);

  const server: ChildProcess = spawn(start.command, start.args, {
    cwd: treeDirectory,
    env: start.environment,
    detached: true,
    stdio: ["ignore", log, log],
  });

  closeSync(log);

  return server;
}

export async function waitForServer(
  server: ChildProcess,
  port: number,
  logPath: string,
): Promise<void> {
  const deadline = Date.now() + 60_000;

  while (Date.now() < deadline) {
    if (server.exitCode !== null)
      throw new Error(`The server on port ${port} exited with ${server.exitCode}. See ${logPath}.`);

    const isUp = await fetch(`http://127.0.0.1:${port}/`, { redirect: "manual" }).then(
      () => true,
      () => false,
    );

    if (isUp) return;

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`The server on port ${port} did not answer within 60 s. See ${logPath}.`);
}

export function stopServer(server: ChildProcess): void {
  if (server.pid === undefined || server.exitCode !== null) return;

  try {
    process.kill(-server.pid, "SIGTERM");
  } catch (cause: unknown) {
    if (!(cause instanceof Error && "code" in cause && cause.code === "ESRCH")) throw cause;
  }
}
