import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test";
import { LibsqlError, createClient, type Client } from "@libsql/client";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { applyMarkChangeWith } from "@/features/marks/apply-mark-change";
import { markRowSchema } from "@/features/marks/schemas";
import { createMarksTableSql } from "@/shared/server/marks-table";

const databaseDirectory = join(
  import.meta.dir,
  "..",
  "..",
  "..",
  ".data",
  `apply-mark-change-test-${process.pid}`,
);

let databaseCount = 0;
let client: Client;

function openDatabase(): Client {
  databaseCount += 1;
  mkdirSync(databaseDirectory, { recursive: true });

  return createClient({ url: `file:${join(databaseDirectory, `marks-${databaseCount}.db`)}` });
}

let loggedErrors: unknown[] = [];

function signedInAs(userId: string | null) {
  return {
    client,
    getUserId: () => Promise.resolve(userId),
    logWriteError: (cause: unknown) => {
      loggedErrors.push(cause);
    },
  };
}

async function seed(userId: string, marks: readonly (readonly [string, string])[]) {
  for (const [code, state] of marks) {
    await client.execute({
      sql: "INSERT INTO marks (user_id, code, state, updated_at) VALUES (?, ?, ?, ?)",
      args: [userId, code, state, "2026-10-16T00:00:00.000Z"],
    });
  }
}

async function storedMarks(userId: string) {
  const result = await client.execute({
    sql: "SELECT code, state FROM marks WHERE user_id = ? ORDER BY code",
    args: [userId],
  });

  return result.rows.map((row) => markRowSchema.parse(row));
}

beforeEach(async () => {
  loggedErrors = [];
  client = openDatabase();
  await client.execute(createMarksTableSql);
});

afterEach(() => {
  client.close();
});

afterAll(() => {
  rmSync(databaseDirectory, { recursive: true, force: true });
});

describe("applyMarkChange", () => {
  test("a set change saves the mark and a second set replaces its state", async () => {
    expect(
      await applyMarkChangeWith(signedInAs("user_a"), "user_a", {
        kind: "set",
        code: "FRA",
        state: "want",
      }),
    ).toEqual({ ok: true });

    expect(
      await applyMarkChangeWith(signedInAs("user_a"), "user_a", {
        kind: "set",
        code: "FRA",
        state: "visited",
      }),
    ).toEqual({ ok: true });

    expect(await storedMarks("user_a")).toEqual([{ code: "FRA", state: "visited" }]);
  });

  test("a clear change removes only that country", async () => {
    await seed("user_a", [
      ["DEU", "want"],
      ["FRA", "visited"],
    ]);

    expect(
      await applyMarkChangeWith(signedInAs("user_a"), "user_a", { kind: "clear", code: "FRA" }),
    ).toEqual({ ok: true });

    expect(await storedMarks("user_a")).toEqual([{ code: "DEU", state: "want" }]);
  });

  test("a reset removes every mark of the session user and no one else's", async () => {
    await seed("user_a", [
      ["DEU", "want"],
      ["FRA", "visited"],
    ]);
    await seed("user_b", [["BRA", "visited"]]);

    expect(await applyMarkChangeWith(signedInAs("user_a"), "user_a", { kind: "reset" })).toEqual({
      ok: true,
    });

    expect(await storedMarks("user_a")).toEqual([]);
    expect(await storedMarks("user_b")).toEqual([{ code: "BRA", state: "visited" }]);
  });

  test("a change from a tab still owned by user A is refused once the session is user B", async () => {
    await seed("user_a", [["DEU", "want"]]);
    await seed("user_b", [["BRA", "visited"]]);

    expect(
      await applyMarkChangeWith(signedInAs("user_b"), "user_a", {
        kind: "set",
        code: "FRA",
        state: "want",
      }),
    ).toEqual({ ok: false, reason: "other-account" });
    expect(await applyMarkChangeWith(signedInAs("user_b"), "user_a", { kind: "reset" })).toEqual({
      ok: false,
      reason: "other-account",
    });

    expect(await storedMarks("user_a")).toEqual([{ code: "DEU", state: "want" }]);
    expect(await storedMarks("user_b")).toEqual([{ code: "BRA", state: "visited" }]);
  });

  test("a change with no session is refused as signed out and writes nothing", async () => {
    await seed("user_a", [["DEU", "want"]]);

    expect(await applyMarkChangeWith(signedInAs(null), "user_a", { kind: "reset" })).toEqual({
      ok: false,
      reason: "signed-out",
    });

    expect(await storedMarks("user_a")).toEqual([{ code: "DEU", state: "want" }]);
  });

  test("a change for an unknown country is rejected and writes nothing", async () => {
    await seed("user_a", [["DEU", "want"]]);

    expect(
      await applyMarkChangeWith(signedInAs("user_a"), "user_a", { kind: "clear", code: "XXX" }),
    ).toEqual({ ok: false, reason: "rejected" });

    expect(await storedMarks("user_a")).toEqual([{ code: "DEU", state: "want" }]);
  });

  test("a database error is reported as unavailable", async () => {
    client.close();
    client = openDatabase();

    expect(
      await applyMarkChangeWith(signedInAs("user_a"), "user_a", {
        kind: "set",
        code: "FRA",
        state: "want",
      }),
    ).toEqual({ ok: false, reason: "unavailable" });

    expect(loggedErrors).toEqual([expect.any(LibsqlError)]);
  });
});
