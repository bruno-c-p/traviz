import "server-only";
import { LibsqlError, type Client } from "@libsql/client";
import { writeMarkChange } from "@/features/marks/marks-table";
import { markChangeSchema } from "@/features/marks/schemas";
import type { MarkChange, MarkChangeResult } from "@/features/marks/marks-sync";

export type MarkChangeServer = {
  readonly client: Client;
  readonly getUserId: () => Promise<string | null>;
  readonly logWriteError: (cause: unknown) => void;
};

export async function applyMarkChangeOn(
  server: MarkChangeServer,
  expectedOwnerId: string,
  change: MarkChange,
): Promise<MarkChangeResult> {
  const userId = await server.getUserId();

  if (userId === null) return { ok: false, reason: "signed-out" };

  if (userId !== expectedOwnerId) return { ok: false, reason: "other-account" };

  const parsedChange = markChangeSchema.safeParse(change);

  if (!parsedChange.success) return { ok: false, reason: "rejected" };

  try {
    await writeMarkChange(server.client, userId, parsedChange.data);
  } catch (cause: unknown) {
    if (!(cause instanceof LibsqlError)) throw cause;

    server.logWriteError(cause);

    return { ok: false, reason: "unavailable" };
  }

  return { ok: true };
}
