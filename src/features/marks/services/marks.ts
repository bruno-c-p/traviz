import "server-only";
import { countryStateSchema } from "@/features/marks/schemas";
import type { CountryState, Marks } from "@/lib/colors";
import { turso } from "@/lib/server/db";

export async function loadMarks(userId: string): Promise<Marks> {
  const result = await turso.execute({
    sql: "SELECT code, state FROM marks WHERE user_id = ?",
    args: [userId],
  });

  const marks: Marks = {};

  for (const row of result.rows) {
    const state = countryStateSchema.safeParse(row.state);

    if (state.success) marks[String(row.code)] = state.data;
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
