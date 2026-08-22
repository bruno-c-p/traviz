import { createAuthClient } from "better-auth/react";
import type { Session, User } from "better-auth/types";

export const authClient = createAuthClient();

export interface AuthSession {
  session: Session;
  user: User;
}

export function useAuthSession(): { data: AuthSession | null; isPending: boolean } {
  const { data, isPending } = authClient.useSession();
  return { data: (data as AuthSession | null) ?? null, isPending };
}
