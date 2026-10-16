"use server";

import { countryCodeSchema } from "@/features/marks/schemas";
import { deleteMarkForUser } from "@/features/marks/services/marks";
import { requireUserId } from "@/features/auth/server";

export async function clearMarkAction(code: string): Promise<void> {
  const userId = await requireUserId();
  const parsedCode = countryCodeSchema.parse(code);
  await deleteMarkForUser(userId, parsedCode);
}
