import "server-only";
import type { Client, InStatement } from "@libsql/client";
import { markRowSchema } from "@/features/marks/schemas";
import type { Marks } from "@/features/marks/colors";
import type { MarkChange, MarksSnapshot } from "@/features/marks/marks-sync";

async function loadMarks(client: Client, userId: string): Promise<Marks> {
  const result = await client.execute({
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

export async function loadMarksSnapshot(client: Client, userId: string): Promise<MarksSnapshot> {
  try {
    return { ok: true, ownerId: userId, marks: await loadMarks(client, userId) };
  } catch (cause: unknown) {
    console.error("The marks could not be read.", cause);

    return { ok: false, ownerId: userId };
  }
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
