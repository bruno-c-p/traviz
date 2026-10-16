import "server-only";
import { cache } from "react";
import { auth } from "@clerk/nextjs/server";

export const getUserId = cache(async () => {
  const { userId } = await auth();

  return userId;
});

export async function requireUserId(): Promise<string> {
  const userId = await getUserId();

  if (!userId) throw new Error("Unauthorized");

  return userId;
}
