import { expect, test } from "bun:test";
import { applyMarkChange } from "@/features/marks/actions/apply-mark-change";
import { markRowSchema } from "@/features/marks/schemas";
import { turso } from "@/shared/server/database";
import { createMarksTableSql } from "@/shared/server/marks-table";

test("the action called with no session rejects and writes nothing", async () => {
  expect(process.env.TURSO_DATABASE_URL).toBe("file::memory:");

  await turso.execute(createMarksTableSql);
  await turso.execute({
    sql: "INSERT INTO marks (user_id, code, state, updated_at) VALUES (?, ?, ?, ?)",
    args: ["user_a", "DEU", "want", "2026-10-16T00:00:00.000Z"],
  });

  const outcome = await applyMarkChange("user_a", { kind: "reset" }).then(
    (result) => result,
    (cause: unknown) => (cause instanceof Error ? cause.message : String(cause)),
  );

  expect(outcome).toStartWith("Clerk: auth()");

  const result = await turso.execute({
    sql: "SELECT code, state FROM marks WHERE user_id = ?",
    args: ["user_a"],
  });

  expect(result.rows.map((row) => markRowSchema.parse(row))).toEqual([
    { code: "DEU", state: "want" },
  ]);
});
