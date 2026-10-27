import "server-only";
import { cache } from "react";
import { getUserId } from "@/features/auth/server";
import type { MarksSnapshot } from "@/features/marks/marks-sync";
import { databaseMarksReader, loadMarksSnapshot } from "@/features/marks/services/marks";

export const loadSessionMarks = cache(async (): Promise<MarksSnapshot | null> => {
  const userId = await getUserId();

  if (userId === null) return null;

  return loadMarksSnapshot(databaseMarksReader, userId);
});
