"use server";

import type { MarksSnapshot } from "@/features/marks/marks-sync";
import { databaseMarksReader, loadMarksSnapshot } from "@/features/marks/services/marks";
import { getUserId } from "@/features/auth/server";

export async function readMarks(expectedOwnerId: string): Promise<MarksSnapshot> {
  const userId = await getUserId();

  if (userId !== expectedOwnerId) return { ok: false, ownerId: expectedOwnerId };

  return loadMarksSnapshot(databaseMarksReader, userId);
}
