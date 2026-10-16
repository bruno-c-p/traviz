import "server-only";
import { markRowSchema } from "@/features/marks/schemas";
import type { CountryState, Marks } from "@/lib/colors";
import { turso } from "@/lib/server/db";

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

export async function upsertMarkForUser(
  userId: string,
  code: string,
  state: CountryState,
): Promise<void> {
  await turso.execute({
    sql: `INSERT INTO marks (user_id, code, state, updated_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, code) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at`,
    args: [userId, code, state, new Date().toISOString()],
  });
}

export async function deleteMarkForUser(userId: string, code: string): Promise<void> {
  await turso.execute({
    sql: "DELETE FROM marks WHERE user_id = ? AND code = ?",
    args: [userId, code],
  });
}

export async function clearMarksForUser(userId: string): Promise<void> {
  await turso.execute({ sql: "DELETE FROM marks WHERE user_id = ?", args: [userId] });
}
