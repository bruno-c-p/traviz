const ACTIVE_CLIENT = /(?:^|; )__client_uat[^=]*=[1-9]/;
const SESSION_COOKIE = /^__session(?:_.+)?$/;
const BARE_SESSION_COOKIE = "__session";

export type DecodeBase64 = (text: string) => string;

export type SessionOwner = "none" | "same" | "other";

export function hasActiveClient(cookie: string): boolean {
  return ACTIVE_CLIENT.test(cookie);
}

function tokenOwner(token: string, ownerId: string, decodeBase64: DecodeBase64): SessionOwner {
  const [, payload = ""] = token.split(".");

  try {
    const claims: unknown = JSON.parse(
      decodeBase64(payload.replaceAll("-", "+").replaceAll("_", "/")),
    );

    if (!(claims instanceof Object) || !("sub" in claims)) return "none";

    return claims.sub === ownerId ? "same" : "other";
  } catch {
    return "none";
  }
}

export function sessionOwner(
  cookie: string,
  ownerId: string,
  decodeBase64: DecodeBase64,
): SessionOwner {
  const sessions = cookie
    .split(";")
    .map((entry) => entry.trim().split("="))
    .filter(([name = ""]) => SESSION_COOKIE.test(name));

  const suffixed = sessions.filter(([name]) => name !== BARE_SESSION_COOKIE);
  const candidates = suffixed.length > 0 ? suffixed : sessions;
  const owners = candidates.map(([, token = ""]) => tokenOwner(token, ownerId, decodeBase64));

  if (owners.includes("same")) return "same";

  return owners.includes("other") ? "other" : "none";
}

export function hasSessionChanged(
  cookie: string,
  ownerId: string | null,
  decodeBase64: DecodeBase64,
): boolean {
  if (!hasActiveClient(cookie)) return true;

  return ownerId !== null && sessionOwner(cookie, ownerId, decodeBase64) === "other";
}
