import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Environment } from "@/shared/testing/perf/builds";
import {
  FIXED_USER_ID,
  readPerfEnvironment,
  withSignInMode,
} from "@/shared/testing/perf/environment";

const fixturesDirectory = join(import.meta.dir, "..", "..", "..", "..", ".data");
const fixtureRoots: string[] = [];
const inherited: Environment = { NODE_ENV: "test" };

const validValues = {
  TURSO_DATABASE_URL: "file:.data/dev.db",
  PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_ZXhhbXBsZSQ",
  CLERK_SECRET_KEY: "sk_test_example",
};

afterAll(() => {
  for (const fixtureRoot of fixtureRoots) rmSync(fixtureRoot, { recursive: true, force: true });
});

function fixtureWith(overrides: Partial<Record<keyof typeof validValues, string>>): string {
  mkdirSync(fixturesDirectory, { recursive: true });

  const fixtureRoot = mkdtempSync(join(fixturesDirectory, "perf-env-test-"));

  const lines = Object.entries({ ...validValues, ...overrides }).flatMap(([name, value]) =>
    value === "" ? [] : [`${name}=${value}`],
  );

  fixtureRoots.push(fixtureRoot);
  writeFileSync(join(fixtureRoot, ".env.local"), `${lines.join("\n")}\n`);

  return fixtureRoot;
}

test("a local database and development Clerk key are ready", () => {
  const fixtureRoot = fixtureWith({});

  expect(readPerfEnvironment(fixtureRoot, inherited)).toMatchObject({
    kind: "ready",
    databaseUrl: `file:${join(realpathSync(fixtureRoot), ".data", "dev.db")}`,
    hasClerkKeys: true,
    environment: {
      PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_ZXhhbXBsZSQ",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_ZXhhbXBsZSQ",
    },
  });
});

test("a local database with no Clerk keys is ready for the fixed user only", () => {
  const environment = readPerfEnvironment(
    fixtureWith({ PUBLIC_CLERK_PUBLISHABLE_KEY: "", CLERK_SECRET_KEY: "" }),
    inherited,
  );

  expect(environment).toMatchObject({ kind: "ready", hasClerkKeys: false });
  expect(readPerfEnvironment(fixtureWith({ CLERK_SECRET_KEY: "" }), inherited)).toMatchObject({
    kind: "ready",
    hasClerkKeys: false,
  });
});

test("drops a server switch the shell or .env.local sets, so only the harness picks the user", () => {
  const fixtureRoot = fixtureWith({});
  const ready = readPerfEnvironment(fixtureRoot, { ...inherited, TRAVIZ_FIXED_USER_ID: "user_x" });

  expect(ready.kind === "ready" && "TRAVIZ_FIXED_USER_ID" in ready.environment).toBe(false);
});

test("the fixed-user mode signs every request in and leaves Clerk out of the build", () => {
  const ready = readPerfEnvironment(fixtureWith({}), inherited);

  if (ready.kind !== "ready") throw new Error(ready.reason);

  expect(withSignInMode(ready.environment, "clerk")).toBe(ready.environment);

  const fixed = withSignInMode(ready.environment, "fixed-user");

  expect(fixed.TRAVIZ_FIXED_USER_ID).toBe(FIXED_USER_ID);
  expect(fixed.PUBLIC_CLERK_PUBLISHABLE_KEY).toBe("");
  expect(fixed.CLERK_SECRET_KEY).toBe("");
  expect("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" in fixed).toBe(false);
  expect(fixed.TURSO_DATABASE_URL).toBe(ready.databaseUrl);
});

test("refuses a remote database", () => {
  expect(
    readPerfEnvironment(
      fixtureWith({ TURSO_DATABASE_URL: "libsql://traviz-prod.turso.io" }),
      inherited,
    ),
  ).toEqual({
    kind: "refused",
    reason:
      "TURSO_DATABASE_URL must be a file: database inside .data/. The harness never writes to a remote database.",
  });
});

test("refuses a non-file: URL even when its path falls inside .data/", () => {
  expect(
    readPerfEnvironment(fixtureWith({ TURSO_DATABASE_URL: "xxxxx.data/x.db" }), inherited),
  ).toEqual({
    kind: "refused",
    reason:
      "TURSO_DATABASE_URL must be a file: database inside .data/. The harness never writes to a remote database.",
  });
});

test("refuses a file: database outside .data/", () => {
  expect(
    readPerfEnvironment(
      fixtureWith({ TURSO_DATABASE_URL: "file:../other-worktree/.data/dev.db" }),
      inherited,
    ).kind,
  ).toBe("refused");
  expect(
    readPerfEnvironment(fixtureWith({ TURSO_DATABASE_URL: "file:.data-evil/dev.db" }), inherited)
      .kind,
  ).toBe("refused");
});

test("refuses a .data/ database that is a symlink to a file outside .data/", () => {
  const fixtureRoot = fixtureWith({});
  const outside = join(fixtureRoot, "elsewhere.db");

  writeFileSync(outside, "");
  mkdirSync(join(fixtureRoot, ".data"));
  symlinkSync(outside, join(fixtureRoot, ".data", "dev.db"));

  expect(readPerfEnvironment(fixtureRoot, inherited).kind).toBe("refused");
});

test("refuses a production Clerk key", () => {
  expect(
    readPerfEnvironment(
      fixtureWith({ PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_ZXhhbXBsZSQ" }),
      inherited,
    ),
  ).toEqual({
    kind: "refused",
    reason: "PUBLIC_CLERK_PUBLISHABLE_KEY must be a Clerk development key.",
  });
  expect(
    readPerfEnvironment(fixtureWith({ CLERK_SECRET_KEY: "sk_live_example" }), inherited),
  ).toEqual({ kind: "refused", reason: "CLERK_SECRET_KEY must be a Clerk development key." });
});
