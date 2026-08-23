"use server";

import type { Marks } from "@/lib/colors";
import { saveMarksForUser } from "@/lib/server/marks";
import { requireUserId } from "@/lib/server/session";

export async function saveMarksAction(marks: Marks): Promise<void> {
  const userId = await requireUserId();
  await saveMarksForUser(userId, marks);
}
