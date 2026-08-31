import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";
import type { Session, User } from "better-auth/types";

export const authClient = createAuthClient({
  plugins: [magicLinkClient()],
});

export interface AuthSession {
  session: Session;
  user: User;
}

export function useAuthSession(): { data: AuthSession | null; isPending: boolean } {
  const { data, isPending } = authClient.useSession();
  return { data: (data as AuthSession | null) ?? null, isPending };
}
