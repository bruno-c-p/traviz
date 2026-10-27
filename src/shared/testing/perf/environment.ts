import { existsSync, readFileSync, realpathSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { parseEnv } from "node:util";
import type { Environment } from "@/shared/testing/perf/builds";

export type PerfEnvironment =
  | { kind: "ready"; environment: Environment; databaseUrl: string }
  | { kind: "refused"; reason: string };

function canonicalPath(path: string): string {
  if (existsSync(path)) return realpathSync(path);

  return existsSync(dirname(path)) ? join(realpathSync(dirname(path)), basename(path)) : path;
}

function refused(reason: string): PerfEnvironment {
  return { kind: "refused", reason };
}

export function readPerfEnvironment(root: string, inherited: Environment): PerfEnvironment {
  const envLocalPath = join(root, ".env.local");

  if (!existsSync(envLocalPath)) return refused("there is no .env.local. Run bun run setup first.");

  const local = parseEnv(readFileSync(envLocalPath, "utf8"));
  const databaseUrl = local.TURSO_DATABASE_URL ?? "";
  const databasePath = canonicalPath(resolve(root, databaseUrl.slice("file:".length)));

  if (
    !databaseUrl.startsWith("file:") ||
    !databasePath.startsWith(canonicalPath(join(root, ".data")) + sep)
  )
    return refused(
      "TURSO_DATABASE_URL must be a file: database inside .data/. The harness never writes to a remote database.",
    );

  if (!local.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_"))
    return refused("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY must be a Clerk development key.");

  const absoluteDatabaseUrl = `file:${databasePath}`;

  return {
    kind: "ready",
    environment: {
      ...inherited,
      ...local,
      TURSO_DATABASE_URL: absoluteDatabaseUrl,
      NEXT_TELEMETRY_DISABLED: "1",
    },
    databaseUrl: absoluteDatabaseUrl,
  };
}
