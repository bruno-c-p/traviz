import "server-only";
import type { Client } from "@libsql/client";
import type { MarkChange } from "@/features/marks/marks-sync";

export async function writeMarkChange(
  client: Client,
  userId: string,
  change: MarkChange,
): Promise<void> {
  switch (change.kind) {
    case "set":
      await client.execute({
        sql: `INSERT INTO marks (user_id, code, state, updated_at) VALUES (?, ?, ?, ?)
          ON CONFLICT(user_id, code) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at`,
        args: [userId, change.code, change.state, new Date().toISOString()],
      });

      return;
    case "clear":
      await client.execute({
        sql: "DELETE FROM marks WHERE user_id = ? AND code = ?",
        args: [userId, change.code],
      });

      return;
    case "reset":
      await client.execute({ sql: "DELETE FROM marks WHERE user_id = ?", args: [userId] });

      return;
  }
}
