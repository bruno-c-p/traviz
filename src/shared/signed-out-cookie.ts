export const SIGNED_OUT_COOKIE = "traviz-signed-out";

const SIGNED_OUT_SECONDS = 10;

export function signedOutCookie(): string {
  return `${SIGNED_OUT_COOKIE}=1; Max-Age=${SIGNED_OUT_SECONDS}; Path=/; SameSite=Lax`;
}
