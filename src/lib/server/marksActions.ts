"use server";

import type { Marks } from "../colors";
import { clearMarksForUser, saveMarksForUser } from "./marks";
import { getSession } from "./session";

async function requireUserId(): Promise<string> {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  return session.user.id;
}

export async function saveMarksAction(marks: Marks): Promise<void> {
  const userId = await requireUserId();
  await saveMarksForUser(userId, marks);
}

export async function clearMarksAction(): Promise<void> {
  const userId = await requireUserId();
  await clearMarksForUser(userId);
}
