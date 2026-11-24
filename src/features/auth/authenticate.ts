import "server-only";

export type SessionState = {
  readonly userId: string | null;
  readonly headers: Headers;
};

export type SessionReader = (request: Request) => Promise<SessionState>;

export type RequestAuth =
  | { readonly kind: "redirect"; readonly location: string; readonly headers: Headers }
  | { readonly kind: "resolved"; readonly userId: string | null; readonly headers: Headers };

export type Authenticate = (request: Request) => Promise<RequestAuth>;

export function fixedUserSession(userId: string): SessionReader {
  return () => Promise.resolve({ userId, headers: new Headers() });
}

export function authenticateWith(readSession: SessionReader): Authenticate {
  return async (request) => {
    const { userId, headers } = await readSession(request);
    const location = headers.get("location");

    if (location !== null) {
      const redirectHeaders = new Headers(headers);

      redirectHeaders.delete("location");

      return { kind: "redirect", location, headers: redirectHeaders };
    }

    return { kind: "resolved", userId, headers };
  };
}
