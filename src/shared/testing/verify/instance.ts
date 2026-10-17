import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { z } from "zod";
import type { Environment } from "@/shared/testing/perf/builds";
import { readPerfEnvironment } from "@/shared/testing/perf/environment";

export const repoRoot = resolve(import.meta.dirname, "../../../..");

export const verifyDirectory = join(repoRoot, ".data", "verify");

export const instanceFile = join(verifyDirectory, "server.json");

export const buildStampFile = join(verifyDirectory, "build.json");

export const serverLogFile = join(verifyDirectory, "server.log");

export const buildLogFile = join(verifyDirectory, "build.log");

const instanceSchema = z.object({ pid: z.number(), port: z.number(), startedAt: z.string() });

export type Instance = z.infer<typeof instanceSchema>;

const buildStampSchema = z.object({ tree: z.string(), builtAt: z.string() });

export type BuildStamp = z.infer<typeof buildStampSchema>;

export function readInstance(): Instance | undefined {
  if (!existsSync(instanceFile)) return undefined;

  const parsed = z
    .string()
    .transform((text, context) => {
      try {
        return z.unknown().parse(JSON.parse(text));
      } catch {
        context.addIssue({ code: "custom", message: "not JSON" });

        return z.NEVER;
      }
    })
    .pipe(instanceSchema)
    .safeParse(readFileSync(instanceFile, "utf8"));

  if (!parsed.success)
    throw new Error(
      `${instanceFile} is not a valid server record, so the server it named cannot be found safely. Read the file, stop that process group by hand, then delete the file.`,
    );

  return parsed.data;
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
    return execFileSync("ps", ["-o", "command=", "-p", String(pid)], {
      encoding: "utf8",
    }).startsWith("next-server");
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

export function databasePath(): string {
  const perfEnvironment = readPerfEnvironment(repoRoot, process.env);

  if (perfEnvironment.kind === "refused") throw new Error(perfEnvironment.reason);

  return perfEnvironment.databaseUrl.slice("file:".length);
}

export function buildHasPublicValues(environment: Environment): boolean {
  const chunks = join(repoRoot, ".next", "static", "chunks");

  const values = [
    environment.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    environment.NEXT_PUBLIC_MAPBOX_TOKEN,
  ];

  if (!existsSync(chunks) || values.some((value) => !value)) return false;

  const sources = readdirSync(chunks, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".js"))
    .map((file) => readFileSync(join(chunks, file), "utf8"));

  return values.every((value) => sources.some((source) => value && source.includes(value)));
}

export function evidenceDirectory(label: string): string {
  const stateHome = process.env.XDG_STATE_HOME ?? join(homedir(), ".local", "state");
  const stamp = new Date().toISOString().replaceAll(":", "-").slice(0, 19);
  const safeLabel = label.replaceAll(/[^A-Za-z0-9-]/g, "-");
  const directory = join(stateHome, "traviz", "verify", `${stamp}-${safeLabel}`);

  mkdirSync(directory, { recursive: true });

  return directory;
}
