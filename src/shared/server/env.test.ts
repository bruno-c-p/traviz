import { afterEach, expect, test } from "bun:test";
import { z } from "zod";

const envModulePath = "@/shared/server/env";
const originalDatabaseUrl = process.env.TURSO_DATABASE_URL;
const originalAuthToken = process.env.TURSO_AUTH_TOKEN;
const originalFixedUserId = process.env.TRAVIZ_FIXED_USER_ID;

const envModuleSchema = z.object({
  env: z.object({
    TURSO_DATABASE_URL: z.string(),
    TURSO_AUTH_TOKEN: z.string().optional(),
    TRAVIZ_FIXED_USER_ID: z.string().optional(),
  }),
});

function setVariable(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function useDatabase(databaseUrl: string | undefined, authToken: string | undefined): void {
  setVariable("TURSO_DATABASE_URL", databaseUrl);
  setVariable("TURSO_AUTH_TOKEN", authToken);
  setVariable("TRAVIZ_FIXED_USER_ID", undefined);
  setVariable("TRAVIZ_DB_DELAY_MS", undefined);
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
  setVariable("TRAVIZ_FIXED_USER_ID", originalFixedUserId);
});

test("a missing database URL fails at import", async () => {
  useDatabase(undefined, undefined);

  expect(await importFailure("missing")).toBe(
    "Invalid environment: TURSO_DATABASE_URL is required",
  );
});

test("a file: database needs no auth token", async () => {
  useDatabase("file:.data/dev.db", undefined);

  expect(await importEnv("file")).toMatchObject({ TURSO_DATABASE_URL: "file:.data/dev.db" });
});

test("a remote database without an auth token fails at import", async () => {
  useDatabase("libsql://x.turso.io", undefined);

  expect(await importFailure("remote-without-token")).toBe(
    "Invalid environment: TURSO_AUTH_TOKEN is required unless TURSO_DATABASE_URL starts with file:",
  );
});

test("a remote database with an auth token passes", async () => {
  useDatabase("libsql://x.turso.io", "token");

  expect(await importEnv("remote-with-token")).toMatchObject({
    TURSO_DATABASE_URL: "libsql://x.turso.io",
    TURSO_AUTH_TOKEN: "token",
  });
});

test("a fixed user is accepted with a file: database", async () => {
  useDatabase("file:.data/dev.db", undefined);
  setVariable("TRAVIZ_FIXED_USER_ID", "user_fixed");

  expect(await importEnv("fixed-user-file")).toMatchObject({ TRAVIZ_FIXED_USER_ID: "user_fixed" });
});

test("a fixed user with a remote database fails at import", async () => {
  useDatabase("libsql://x.turso.io", "token");
  setVariable("TRAVIZ_FIXED_USER_ID", "user_fixed");

  expect(await importFailure("fixed-user-remote")).toBe(
    "Invalid environment: TRAVIZ_FIXED_USER_ID is allowed only when TURSO_DATABASE_URL starts with file:",
  );
});

test("an empty fixed user counts as unset", async () => {
  useDatabase("libsql://x.turso.io", "token");
  setVariable("TRAVIZ_FIXED_USER_ID", "");

  expect((await importEnv("fixed-user-empty")).TRAVIZ_FIXED_USER_ID).toBeUndefined();
});

test("a database delay is refused with a remote database", async () => {
  useDatabase("libsql://x.turso.io", "token");
  setVariable("TRAVIZ_DB_DELAY_MS", "250");

  expect(await importFailure("delay-remote")).toBe(
    "Invalid environment: TRAVIZ_DB_DELAY_MS is allowed only when TURSO_DATABASE_URL starts with file:",
  );
});
