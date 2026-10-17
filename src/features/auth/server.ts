import "server-only";
import { cache } from "react";
import { auth } from "@clerk/nextjs/server";

export const getUserId = cache(async () => {
  const { userId } = await auth();

  return userId;
});
