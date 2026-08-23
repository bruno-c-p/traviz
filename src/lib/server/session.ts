import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "@/lib/server/auth";

export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

export async function requireUserId(): Promise<string> {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  return session.user.id;
}
