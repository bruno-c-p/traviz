import { describe, expect, test } from "bun:test";
import type { Route } from "next";
import { homePath, listPath, signInPath, signInVerifyPath, statsPath } from "@/paths";
import type { RouteAccess } from "@/paths";
import { decideGate, gateRequest, redirectFor, routeAccess } from "@/shared/route-gate";

describe("routeAccess", () => {
  const cases: { pathname: string; access: RouteAccess }[] = [
    { pathname: homePath(), access: "signedIn" },
    { pathname: listPath(), access: "signedIn" },
    { pathname: statsPath(), access: "signedIn" },
    { pathname: signInPath(), access: "signedOut" },
    { pathname: signInVerifyPath(), access: "anyone" },
    { pathname: "/unknown", access: "signedIn" },
    { pathname: "/sign-in/unknown", access: "signedIn" },
  ];

  test.each(cases)("$pathname is $access", ({ pathname, access }) => {
    expect(routeAccess(pathname)).toBe(access);
  });
});

describe("decideGate", () => {
  const cases: { access: RouteAccess; isAuthenticated: boolean; redirect: Route | undefined }[] = [
    { access: "signedIn", isAuthenticated: false, redirect: signInPath() },
    { access: "signedIn", isAuthenticated: true, redirect: undefined },
    { access: "signedOut", isAuthenticated: false, redirect: undefined },
    { access: "signedOut", isAuthenticated: true, redirect: homePath() },
    { access: "anyone", isAuthenticated: false, redirect: undefined },
    { access: "anyone", isAuthenticated: true, redirect: undefined },
  ];

  test.each(cases)(
    "$access with isAuthenticated=$isAuthenticated redirects to $redirect",
    ({ access, isAuthenticated, redirect }) => {
      expect(decideGate(access, isAuthenticated)).toBe(redirect);
    },
  );
});

describe("redirectFor", () => {
  const cases: { pathname: string; isAuthenticated: boolean; redirect: Route | undefined }[] = [
    { pathname: signInVerifyPath(), isAuthenticated: true, redirect: undefined },
    { pathname: signInVerifyPath(), isAuthenticated: false, redirect: undefined },
    { pathname: signInPath(), isAuthenticated: true, redirect: homePath() },
    { pathname: listPath(), isAuthenticated: false, redirect: signInPath() },
    { pathname: "/sign-in/unknown", isAuthenticated: false, redirect: signInPath() },
    { pathname: "/sign-in/unknown", isAuthenticated: true, redirect: undefined },
  ];

  test.each(cases)(
    "$pathname with isAuthenticated=$isAuthenticated redirects to $redirect",
    ({ pathname, isAuthenticated, redirect }) => {
      expect(redirectFor(pathname, isAuthenticated)).toBe(redirect);
    },
  );
});

describe("gateRequest", () => {
  const signedOut = () => Promise.resolve(false);

  test("a Server Action POST to a signed-in route passes without reading the session", async () => {
    let sessionReads = 0;

    const redirect = await gateRequest(
      { method: "POST", hasActionHeader: true, pathname: listPath() },
      () => {
        sessionReads += 1;

        return Promise.resolve(false);
      },
    );

    expect(redirect).toBeUndefined();
    expect(sessionReads).toBe(0);
  });

  const redirectCases: { method: string; hasActionHeader: boolean }[] = [
    { method: "GET", hasActionHeader: false },
    { method: "POST", hasActionHeader: false },
    { method: "GET", hasActionHeader: true },
  ];

  test.each(redirectCases)(
    "a signed-out $method with hasActionHeader=$hasActionHeader goes to sign-in",
    async ({ method, hasActionHeader }) => {
      expect(await gateRequest({ method, hasActionHeader, pathname: listPath() }, signedOut)).toBe(
        signInPath(),
      );
    },
  );
});
