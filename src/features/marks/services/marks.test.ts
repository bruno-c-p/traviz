import { afterAll, afterEach, expect, test } from "bun:test";
import { createClient, type Client } from "@libsql/client";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { loadMarksSnapshot } from "@/features/marks/services/marks";
import { createMarksTableSql } from "@/shared/server/marks-table";

const databaseDirectory = join(
  import.meta.dir,
  "..",
  "..",
  "..",
  "..",
  ".data",
  `load-marks-snapshot-test-${process.pid}`,
);

let databaseCount = 0;
const clients: Client[] = [];
let loggedErrors: unknown[] = [];

function readerFor(client: Client) {
  return {
    client,
    logReadError: (cause: unknown) => {
      loggedErrors.push(cause);
    },
  };
}

function openDatabase(): Client {
  databaseCount += 1;
  mkdirSync(databaseDirectory, { recursive: true });

  const client = createClient({
    url: `file:${join(databaseDirectory, `marks-${databaseCount}.db`)}`,
  });

  clients.push(client);

  return client;
}

afterEach(() => {
  loggedErrors = [];

  for (const client of clients.splice(0)) client.close();
});

afterAll(() => {
  rmSync(databaseDirectory, { recursive: true, force: true });
});

test("the snapshot holds only the user's own marks", async () => {
  const client = openDatabase();
  await client.execute(createMarksTableSql);

  for (const [userId, code, state] of [
    ["user_a", "DEU", "want"],
    ["user_a", "FRA", "visited"],
    ["user_b", "ITA", "not_interested"],
  ]) {
    await client.execute({
      sql: "INSERT INTO marks (user_id, code, state, updated_at) VALUES (?, ?, ?, ?)",
      args: [userId, code, state, "2026-10-16T00:00:00.000Z"],
    });
  }

  expect(await loadMarksSnapshot(readerFor(client), "user_a")).toEqual({
    ok: true,
    ownerId: "user_a",
    marks: { DEU: "want", FRA: "visited" },
  });
});

test("a user with no marks gets an empty snapshot", async () => {
  const client = openDatabase();
  await client.execute(createMarksTableSql);

  expect(await loadMarksSnapshot(readerFor(client), "user_a")).toEqual({
    ok: true,
    ownerId: "user_a",
    marks: {},
  });
});

test("a database error gives a failed snapshot for that user", async () => {
  const client = openDatabase();

  expect(await loadMarksSnapshot(readerFor(client), "user_a")).toEqual({
    ok: false,
    ownerId: "user_a",
  });
  expect(loggedErrors).toHaveLength(1);
});
