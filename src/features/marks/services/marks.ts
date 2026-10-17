import "server-only";
import type { Client, InStatement } from "@libsql/client";
import { markRowSchema } from "@/features/marks/schemas";
import type { CountryState, Marks } from "@/features/marks/colors";
import type { MarkChange } from "@/features/marks/marks-sync";
import { turso } from "@/shared/server/database";

export async function loadMarks(userId: string): Promise<Marks> {
  const result = await turso.execute({
    sql: "SELECT code, state FROM marks WHERE user_id = ?",
    args: [userId],
  });

  const marks: Marks = {};

  for (const row of result.rows) {
    const mark = markRowSchema.safeParse(row);

    if (mark.success) marks[mark.data.code] = mark.data.state;
  }

  return marks;
}

function markChangeStatement(userId: string, change: MarkChange): InStatement {
  switch (change.kind) {
    case "set":
      return {
        sql: `INSERT INTO marks (user_id, code, state, updated_at) VALUES (?, ?, ?, ?)
          ON CONFLICT(user_id, code) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at`,
        args: [userId, change.code, change.state, new Date().toISOString()],
      };
    case "clear":
      return {
        sql: "DELETE FROM marks WHERE user_id = ? AND code = ?",
        args: [userId, change.code],
      };
    case "reset":
      return { sql: "DELETE FROM marks WHERE user_id = ?", args: [userId] };
  }
}

export async function writeMarkChange(
  client: Client,
  userId: string,
  change: MarkChange,
): Promise<void> {
  await client.execute(markChangeStatement(userId, change));
}

export async function upsertMarkForUser(
  userId: string,
  code: string,
  state: CountryState,
): Promise<void> {
  await writeMarkChange(turso, userId, { kind: "set", code, state });
}

export async function deleteMarkForUser(userId: string, code: string): Promise<void> {
  await writeMarkChange(turso, userId, { kind: "clear", code });
}

export async function clearMarksForUser(userId: string): Promise<void> {
  await writeMarkChange(turso, userId, { kind: "reset" });
}
