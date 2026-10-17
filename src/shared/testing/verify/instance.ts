import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { z } from "zod";

export const repoRoot = resolve(import.meta.dirname, "../../../..");

export const verifyDirectory = join(repoRoot, ".data", "verify");

export const instanceFile = join(verifyDirectory, "server.json");

export const buildStampFile = join(verifyDirectory, "build.json");

export const serverLogFile = join(verifyDirectory, "server.log");

export const buildLogFile = join(verifyDirectory, "build.log");

export const databaseFile = join(repoRoot, ".data", "dev.db");

const instanceSchema = z.object({ pid: z.number(), port: z.number(), startedAt: z.string() });

export type Instance = z.infer<typeof instanceSchema>;

const buildStampSchema = z.object({ tree: z.string(), builtAt: z.string() });

export type BuildStamp = z.infer<typeof buildStampSchema>;

export function readInstance(): Instance | undefined {
  if (!existsSync(instanceFile)) return undefined;

  return instanceSchema.parse(JSON.parse(readFileSync(instanceFile, "utf8")));
}

export function readBuildStamp(): BuildStamp | undefined {
  if (!existsSync(buildStampFile)) return undefined;

  return buildStampSchema.parse(JSON.parse(readFileSync(buildStampFile, "utf8")));
}

export function requireBaseUrl(): string {
  const instance = readInstance();

  if (!instance || !isAlive(instance.pid))
    throw new Error(
      "No verify server is running in this worktree. Run bun run verify:server start first.",
    );

  return `http://localhost:${instance.port}`;
}

export function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);

    return true;
  } catch {
    return false;
  }
}

export function treeFingerprint(): string {
  const git = (args: string[], input?: string) =>
    execFileSync("git", ["-C", repoRoot, ...args], { encoding: "utf8", input });

  const untracked = git(["ls-files", "--others", "--exclude-standard"]);

  return createHash("sha256")
    .update(git(["rev-parse", "HEAD"]))
    .update(git(["diff", "HEAD", "--binary"]))
    .update(untracked === "" ? "" : git(["hash-object", "--stdin-paths"], untracked))
    .digest("hex");
}

export function buildHasKey(publishableKey: string): boolean {
  const chunks = join(repoRoot, ".next", "static", "chunks");

  if (!existsSync(chunks)) return false;

  return readdirSync(chunks, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".js"))
    .some((file) => readFileSync(join(chunks, file), "utf8").includes(publishableKey));
}

export function evidenceDirectory(label: string): string {
  const stateHome = process.env.XDG_STATE_HOME ?? join(homedir(), ".local", "state");
  const stamp = new Date().toISOString().replaceAll(":", "-").slice(0, 19);
  const directory = join(stateHome, "traviz", "verify", `${stamp}-${label}`);

  mkdirSync(directory, { recursive: true });

  return directory;
}
