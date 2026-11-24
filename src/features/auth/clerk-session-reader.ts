import "server-only";
import { createClerkClient } from "@clerk/backend";
import type { SessionReader } from "@/features/auth/authenticate";

type ClerkKeys = {
  readonly secretKey: string | undefined;
  readonly publishableKey: string | undefined;
};

export function missingClerkKeys({ secretKey, publishableKey }: ClerkKeys): string[] {
  return [
    ...(secretKey === undefined ? ["CLERK_SECRET_KEY"] : []),
    ...(publishableKey === undefined ? ["PUBLIC_CLERK_PUBLISHABLE_KEY"] : []),
  ];
}

export function parseAuthorizedParties(value: string | undefined): string[] | undefined {
  const origins = (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin !== "");

  const invalid = origins.filter(
    (origin) => !URL.canParse(origin) || new URL(origin).origin !== origin,
  );

  if (invalid.length > 0) {
    throw new Error(
      `Invalid environment: CLERK_AUTHORIZED_PARTIES must list origins such as https://traviz.example, not ${invalid.join(", ")}.`,
    );
  }

  return origins.length > 0 ? origins : undefined;
}

export function readClerkSession(
  keys: ClerkKeys,
  authorizedParties: string[] | undefined,
): SessionReader {
  const missing = missingClerkKeys(keys);

  if (missing.length > 0) {
    throw new Error(
      `Invalid environment: ${missing.join(" and ")} must be set, or TRAVIZ_FIXED_USER_ID with a file: database.`,
    );
  }

  const client = createClerkClient(keys);

  return async (request) => {
    const state = await client.authenticateRequest(request, { authorizedParties });

    if (state.status === "handshake" && !state.headers.has("location")) {
      throw new Error("Clerk asked for a handshake without a redirect.");
    }

    return {
      userId: state.status === "signed-in" ? state.toAuth().userId : null,
      headers: state.headers,
    };
  };
}
