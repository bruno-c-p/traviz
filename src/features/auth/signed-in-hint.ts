import { SIGNED_OUT_COOKIE } from "@/shared/signed-out-cookie";

export function isSignedInVisitor(
  cookie: string,
  clientCookie: string,
  signedOutCookie: string,
): boolean {
  const values = new Map<string, string>();

  for (const entry of cookie.split("; ")) {
    const separator = entry.indexOf("=");

    if (separator > 0) values.set(entry.slice(0, separator), entry.slice(separator + 1));
  }

  return /^[1-9]/.test(values.get(clientCookie) ?? "") && values.get(signedOutCookie) !== "1";
}

export function clientCookieName(cookieSuffix: string | null): string {
  return cookieSuffix === null ? "__client_uat" : `__client_uat_${cookieSuffix}`;
}

export function signedInHintScript(homePath: string, cookieSuffix: string | null): string {
  const cookieNames = [clientCookieName(cookieSuffix), SIGNED_OUT_COOKIE]
    .map((name) => JSON.stringify(name))
    .join(",");

  return `if((${isSignedInVisitor.toString()})(document.cookie,${cookieNames}))location.replace(${JSON.stringify(homePath)})`;
}
