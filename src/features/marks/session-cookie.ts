import "client-only";

const SESSION_COOKIE = /^__session(?:_.+)?$/;
const BARE_SESSION_COOKIE = "__session";

function decodeBase64Url(text: string): string {
  return atob(text.replaceAll("-", "+").replaceAll("_", "/"));
}

function tokenHasSubject(token: string, ownerId: string): boolean {
  const [, payload = ""] = token.split(".");

  try {
    const claims: unknown = JSON.parse(decodeBase64Url(payload));

    return claims instanceof Object && "sub" in claims && claims.sub === ownerId;
  } catch {
    return false;
  }
}

export function isSignedInAs(cookie: string, ownerId: string): boolean {
  const sessions = cookie
    .split(";")
    .map((entry) => entry.trim().split("="))
    .filter(([name = ""]) => SESSION_COOKIE.test(name));

  const suffixed = sessions.filter(([name]) => name !== BARE_SESSION_COOKIE);
  const candidates = suffixed.length > 0 ? suffixed : sessions;

  return candidates.some(([, token = ""]) => tokenHasSubject(token, ownerId));
}
