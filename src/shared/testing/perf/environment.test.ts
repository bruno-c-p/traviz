import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Environment } from "@/shared/testing/perf/builds";
import { readPerfEnvironment } from "@/shared/testing/perf/environment";

const fixturesDirectory = join(import.meta.dir, "..", "..", "..", "..", ".data");
const fixtureRoots: string[] = [];
const inherited: Environment = { NODE_ENV: "test" };

const validValues = {
  TURSO_DATABASE_URL: "file:.data/dev.db",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_ZXhhbXBsZSQ",
  CLERK_SECRET_KEY: "sk_test_example",
  NEXT_PUBLIC_MAPBOX_TOKEN: "pk.example",
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

test("a local database, development Clerk key and Mapbox token are ready", () => {
  const fixtureRoot = fixtureWith({});

  expect(readPerfEnvironment(fixtureRoot, inherited)).toMatchObject({
    kind: "ready",
    databaseUrl: `file:${join(realpathSync(fixtureRoot), ".data", "dev.db")}`,
  });
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
      fixtureWith({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_ZXhhbXBsZSQ" }),
      inherited,
    ),
  ).toEqual({
    kind: "refused",
    reason: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY must be a Clerk development key.",
  });
});

test("refuses a missing Mapbox token", () => {
  expect(readPerfEnvironment(fixtureWith({ NEXT_PUBLIC_MAPBOX_TOKEN: "" }), inherited)).toEqual({
    kind: "refused",
    reason: "NEXT_PUBLIC_MAPBOX_TOKEN is missing, so there is no globe to measure.",
  });
});
