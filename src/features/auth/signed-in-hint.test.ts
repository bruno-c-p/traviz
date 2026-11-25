import { describe, expect, test } from "bun:test";
import {
  clientCookieName,
  isSignedInVisitor,
  signedInHintScript,
} from "@/features/auth/signed-in-hint";
import { SIGNED_OUT_COOKIE } from "@/shared/signed-out-cookie";

const OWN_COOKIE = clientCookieName("AbCd1234");

const isSentHome = (cookie: string, clientCookie = OWN_COOKIE) =>
  isSignedInVisitor(cookie, clientCookie, SIGNED_OUT_COOKIE);

describe("the landing page's signed-in hint", () => {
  test("sends a visitor with this app's Clerk client cookie home", () => {
    expect(isSentHome("theme=dark; __client_uat_AbCd1234=1795000000")).toBe(true);
  });

  test("keeps a visitor who is signed out of Clerk on the page", () => {
    expect(isSentHome("__client_uat_AbCd1234=0")).toBe(false);
    expect(isSentHome("")).toBe(false);
  });

  test("ignores another Clerk app's cookie on the same parent domain", () => {
    expect(isSentHome("__client_uat_Zz99Yy88=1795000000")).toBe(false);
    expect(isSentHome("__client_uat=1795000000")).toBe(false);
  });

  test("stays put when the server has just sent the visitor back as signed out", () => {
    expect(isSentHome(`__client_uat_AbCd1234=1795000000; ${SIGNED_OUT_COOKIE}=1`)).toBe(false);
  });

  test("uses the unsuffixed cookie when the build has no publishable key", () => {
    const unsuffixed = clientCookieName(null);

    expect(unsuffixed).toBe("__client_uat");
    expect(isSentHome("__client_uat=1795000000", unsuffixed)).toBe(true);
    expect(isSentHome(`__client_uat=1795000000; ${SIGNED_OUT_COOKIE}=1`, unsuffixed)).toBe(false);
  });

  test("the inline script calls the tested function with this app's cookie names", () => {
    const script = signedInHintScript("/", "AbCd1234");

    expect(script).toContain(isSignedInVisitor.toString());
    expect(script).toContain(`(document.cookie,"__client_uat_AbCd1234","${SIGNED_OUT_COOKIE}")`);
    expect(script.endsWith('location.replace("/")')).toBe(true);
    expect(script).not.toContain("import");
  });
});
