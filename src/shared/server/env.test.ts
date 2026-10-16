import { afterEach, expect, test } from "bun:test";
import { z } from "zod";

const envModulePath = "@/shared/server/env";
const originalDatabaseUrl = process.env.TURSO_DATABASE_URL;
const originalAuthToken = process.env.TURSO_AUTH_TOKEN;

const envModuleSchema = z.object({
  env: z.object({ TURSO_DATABASE_URL: z.string(), TURSO_AUTH_TOKEN: z.string().optional() }),
});

function setVariable(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function useDatabase(databaseUrl: string | undefined, authToken: string | undefined): void {
  setVariable("TURSO_DATABASE_URL", databaseUrl);
  setVariable("TURSO_AUTH_TOKEN", authToken);
}

async function importEnv(caseName: string) {
  const loaded: unknown = await import(`${envModulePath}?case=${caseName}`);

  return envModuleSchema.parse(loaded).env;
}

async function importFailure(caseName: string): Promise<string> {
  return importEnv(caseName).then(
    () => "imported",
    (cause: unknown) => (cause instanceof Error ? cause.message : String(cause)),
  );
}

afterEach(() => {
  useDatabase(originalDatabaseUrl, originalAuthToken);
});

test("a missing database URL fails at import", async () => {
  useDatabase(undefined, undefined);

  expect(await importFailure("missing")).toBe(
    "Invalid environment: TURSO_DATABASE_URL is required",
  );
});

test("a file: database needs no auth token", async () => {
  useDatabase("file:.data/dev.db", undefined);

  expect(await importEnv("file")).toEqual({ TURSO_DATABASE_URL: "file:.data/dev.db" });
});

test("a remote database without an auth token fails at import", async () => {
  useDatabase("libsql://x.turso.io", undefined);

  expect(await importFailure("remote-without-token")).toBe(
    "Invalid environment: TURSO_AUTH_TOKEN is required unless TURSO_DATABASE_URL starts with file:",
  );
});

test("a remote database with an auth token passes", async () => {
  useDatabase("libsql://x.turso.io", "token");

  expect(await importEnv("remote-with-token")).toEqual({
    TURSO_DATABASE_URL: "libsql://x.turso.io",
    TURSO_AUTH_TOKEN: "token",
  });
});
