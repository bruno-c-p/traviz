import "server-only";
import type { Client } from "@libsql/client";
import { markChangeSchema } from "@/features/marks/schemas";
import type { MarkChange, MarkChangeResult } from "@/features/marks/marks-sync";
import { writeMarkChange } from "@/features/marks/services/marks";

type MarkChangeDependencies = {
  readonly client: Client;
  readonly getUserId: () => Promise<string | null>;
  readonly logWriteError: (cause: unknown) => void;
};

export async function applyMarkChangeWith(
  dependencies: MarkChangeDependencies,
  expectedOwnerId: string,
  change: MarkChange,
): Promise<MarkChangeResult> {
  const userId = await dependencies.getUserId();

  if (userId === null) return { ok: false, reason: "signed-out" };

  if (userId !== expectedOwnerId) return { ok: false, reason: "other-account" };

  const parsedChange = markChangeSchema.safeParse(change);

  if (!parsedChange.success) return { ok: false, reason: "rejected" };

  try {
    await writeMarkChange(dependencies.client, userId, parsedChange.data);
  } catch (cause: unknown) {
    dependencies.logWriteError(cause);

    return { ok: false, reason: "unavailable" };
  }

  return { ok: true };
}
