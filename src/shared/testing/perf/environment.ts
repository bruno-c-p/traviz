import { existsSync, readFileSync, realpathSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { parseEnv } from "node:util";
import type { Environment } from "@/shared/testing/perf/builds";

export type SignInMode = "clerk" | "fixed-user";

export const FIXED_USER_ID = "user_local_fixed";

export type PerfEnvironment =
  | { kind: "ready"; environment: Environment; databaseUrl: string; hasClerkKeys: boolean }
  | { kind: "refused"; reason: string };

const CLERK_NAMES = [
  "PUBLIC_CLERK_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
];

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

  const publishableKey = local.PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
  const secretKey = local.CLERK_SECRET_KEY ?? "";

  if (publishableKey !== "" && !publishableKey.startsWith("pk_test_"))
    return refused("PUBLIC_CLERK_PUBLISHABLE_KEY must be a Clerk development key.");

  if (secretKey !== "" && !secretKey.startsWith("sk_test_"))
    return refused("CLERK_SECRET_KEY must be a Clerk development key.");

  const absoluteDatabaseUrl = `file:${databasePath}`;
  const hasClerkKeys = publishableKey !== "" && secretKey !== "";

  const withoutServerSwitches = Object.fromEntries(
    Object.entries({ ...inherited, ...local }).filter(([name]) => !name.startsWith("TRAVIZ_")),
  );

  const environment: Environment = {
    ...withoutServerSwitches,
    TURSO_DATABASE_URL: absoluteDatabaseUrl,
    NEXT_TELEMETRY_DISABLED: "1",
    ASTRO_TELEMETRY_DISABLED: "1",
  };

  if (hasClerkKeys) environment.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = publishableKey;

  return { kind: "ready", environment, databaseUrl: absoluteDatabaseUrl, hasClerkKeys };
}

export function withSignInMode(environment: Environment, mode: SignInMode): Environment {
  if (mode === "clerk") return environment;

  return {
    ...Object.fromEntries(
      Object.entries(environment).filter(([name]) => !CLERK_NAMES.includes(name)),
    ),
    PUBLIC_CLERK_PUBLISHABLE_KEY: "",
    CLERK_SECRET_KEY: "",
    TRAVIZ_FIXED_USER_ID: FIXED_USER_ID,
  };
}
