"use server";

import { clearMarksForUser } from "@/lib/server/marks";
import { requireUserId } from "@/lib/server/session";

export async function clearMarksAction(): Promise<void> {
  const userId = await requireUserId();
  await clearMarksForUser(userId);
}
