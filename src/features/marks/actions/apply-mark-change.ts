"use server";

import { applyMarkChangeOn } from "@/features/marks/apply-mark-change";
import type { MarkChange, MarkChangeResult } from "@/features/marks/marks-sync";
import { getUserId } from "@/features/auth/server";
import { turso } from "@/shared/server/database";

export async function applyMarkChange(
  expectedOwnerId: string,
  change: MarkChange,
): Promise<MarkChangeResult> {
  return applyMarkChangeOn({ client: turso, getUserId }, expectedOwnerId, change);
}
