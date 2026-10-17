"use server";

import type { MarksSnapshot } from "@/features/marks/marks-sync";
import { loadMarksSnapshot } from "@/features/marks/services/marks";
import { getUserId } from "@/features/auth/server";
import { turso } from "@/shared/server/database";

export async function readMarks(expectedOwnerId: string): Promise<MarksSnapshot> {
  const userId = await getUserId();

  if (userId !== expectedOwnerId) return { ok: false, ownerId: expectedOwnerId };

  return loadMarksSnapshot(turso, userId);
}
