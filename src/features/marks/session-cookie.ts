import "client-only";

const SESSION_COOKIE = /^__session(?:_.+)?$/;

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
  return cookie.split(";").some((entry) => {
    const [name = "", token = ""] = entry.trim().split("=");

    return SESSION_COOKIE.test(name) && tokenHasSubject(token, ownerId);
  });
}
