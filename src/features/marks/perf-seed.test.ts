import { afterAll, expect, test } from "bun:test";
import { createClient } from "@libsql/client";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { markRowSchema } from "@/features/marks/schemas";
import { createMarksTableSql } from "@/shared/server/marks-table";
import { seedMarks } from "@/shared/testing/perf/seed";

const databaseDirectory = join(
  import.meta.dir,
  "..",
  "..",
  "..",
  ".data",
  `perf-seed-test-${process.pid}`,
);

afterAll(() => {
  rmSync(databaseDirectory, { recursive: true, force: true });
});

test("the perf seed writes rows that the marks schema reads back", async () => {
  mkdirSync(databaseDirectory, { recursive: true });

  const databaseUrl = `file:${join(databaseDirectory, "marks.db")}`;
  const client = createClient({ url: databaseUrl });

  await client.execute(createMarksTableSql);
  await seedMarks(databaseUrl, "user_perf", [["AFG", "visited"]]);
  await seedMarks(databaseUrl, "user_perf", [
    ["AGO", "visited"],
    ["ALB", "want"],
    ["DZA", "not_interested"],
  ]);

  const result = await client.execute({
    sql: "SELECT code, state FROM marks WHERE user_id = ? ORDER BY code",
    args: ["user_perf"],
  });

  client.close();

  expect(result.rows.map((row) => markRowSchema.parse(row))).toEqual([
    { code: "AGO", state: "visited" },
    { code: "ALB", state: "want" },
    { code: "DZA", state: "not_interested" },
  ]);
});
