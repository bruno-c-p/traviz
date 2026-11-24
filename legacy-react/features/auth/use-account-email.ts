import { useSyncExternalStore } from "react";
import { clerkSession } from "@/features/auth/clerk-session";

export function useAccountEmail(): string | null {
  return useSyncExternalStore(clerkSession.subscribe, clerkSession.email, () => null);
}
