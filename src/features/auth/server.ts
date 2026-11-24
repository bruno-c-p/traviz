import "server-only";
import { authenticateWith, fixedUserSession } from "@/features/auth/authenticate";
import type { Authenticate } from "@/features/auth/authenticate";
import { parseAuthorizedParties, readClerkSession } from "@/features/auth/clerk-session-reader";
import { env } from "@/shared/server/env";

let authenticate: Authenticate | undefined;

export function authenticateRequest(request: Request) {
  authenticate ??= authenticateWith(
    env.TRAVIZ_FIXED_USER_ID === undefined
      ? readClerkSession(
          {
            secretKey: env.CLERK_SECRET_KEY,
            publishableKey: env.PUBLIC_CLERK_PUBLISHABLE_KEY,
          },
          parseAuthorizedParties(env.CLERK_AUTHORIZED_PARTIES),
        )
      : fixedUserSession(env.TRAVIZ_FIXED_USER_ID),
  );

  return authenticate(request);
}
