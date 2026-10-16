"use server";

import { clearMarksForUser } from "@/features/marks/services/marks";
import { requireUserId } from "@/features/auth/server";

export async function clearMarksAction(): Promise<void> {
  const userId = await requireUserId();
  await clearMarksForUser(userId);
}
