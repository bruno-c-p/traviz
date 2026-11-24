import { describe, expect, test } from "bun:test";
import {
  applyMarkChangePath,
  homePath,
  listFragmentPath,
  listPath,
  notFoundPath,
  readMarksPath,
  signInPath,
  signInVerifyPath,
  statsPath,
  welcomePath,
} from "@/paths";
import type { Route, RouteAccess } from "@/paths";
import { decideGate, gateRequest, redirectFor, routeAccess } from "@/shared/route-gate";
import type { GateAuth } from "@/shared/route-gate";

describe("routeAccess", () => {
  const cases: { pathname: string; access: RouteAccess }[] = [
    { pathname: homePath(), access: "signedIn" },
    { pathname: listPath(), access: "signedIn" },
    { pathname: statsPath(), access: "signedIn" },
    { pathname: signInPath(), access: "signedOut" },
    { pathname: welcomePath(), access: "signedOut" },
    { pathname: signInVerifyPath(), access: "anyone" },
    { pathname: listFragmentPath(), access: "signedIn" },
    { pathname: applyMarkChangePath(), access: "anyone" },
    { pathname: readMarksPath(), access: "anyone" },
    { pathname: notFoundPath(), access: "anyone" },
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
    { pathname: homePath(), isAuthenticated: false, redirect: welcomePath() },
    { pathname: homePath(), isAuthenticated: true, redirect: undefined },
    { pathname: welcomePath(), isAuthenticated: false, redirect: undefined },
    { pathname: welcomePath(), isAuthenticated: true, redirect: homePath() },
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
  const origin = "https://traviz.test";

  const answers =
    (userId: string | null, headers: Headers = new Headers()) =>
    (): Promise<GateAuth> =>
      Promise.resolve({ kind: "resolved", userId, headers });

  const page = (userId: string | null) =>
    Promise.resolve(new Response(`page for ${userId ?? "nobody"}`, { status: 200 }));

  const neverRendered = () => Promise.reject(new Error("The gate rendered a page."));

  const signedOutCases: { pathname: string; location: Route }[] = [
    { pathname: homePath(), location: welcomePath() },
    { pathname: listPath(), location: signInPath() },
    { pathname: statsPath(), location: signInPath() },
    { pathname: listFragmentPath(), location: signInPath() },
    { pathname: "/unknown", location: signInPath() },
  ];

  test.each(signedOutCases)(
    "a signed-out request to $pathname is sent to $location",
    async ({ pathname, location }) => {
      const response = await gateRequest(
        new Request(`${origin}${pathname}`),
        answers(null),
        neverRendered,
      );

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(location);
    },
  );

  test.each([welcomePath(), signInPath(), signInVerifyPath(), applyMarkChangePath()])(
    "a signed-out request to %s is rendered with no user",
    async (pathname) => {
      const response = await gateRequest(new Request(`${origin}${pathname}`), answers(null), page);

      expect(response.status).toBe(200);
      expect(await response.text()).toBe("page for nobody");
    },
  );

  test.each([homePath(), listPath(), statsPath(), signInVerifyPath(), readMarksPath()])(
    "a signed-in request to %s is rendered for its user",
    async (pathname) => {
      const response = await gateRequest(
        new Request(`${origin}${pathname}`),
        answers("user_a"),
        page,
      );

      expect(await response.text()).toBe("page for user_a");
    },
  );

  test.each([welcomePath(), signInPath()])(
    "a signed-in request to %s is sent home",
    async (pathname) => {
      const response = await gateRequest(
        new Request(`${origin}${pathname}`),
        answers("user_a"),
        neverRendered,
      );

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(homePath());
    },
  );

  test("the query string does not change the route that is gated", async () => {
    const response = await gateRequest(
      new Request(`${origin}${listPath()}?continent=Europe`),
      answers(null),
      neverRendered,
    );

    expect(response.headers.get("location")).toBe(signInPath());
  });

  test("a redirect the session asks for is answered before any page renders, with its cookies", async () => {
    const headers = new Headers();

    headers.append("set-cookie", "__clerk_db_jwt=one; Path=/");
    headers.append("set-cookie", "__client_uat=0; Path=/");

    const response = await gateRequest(
      new Request(`${origin}${listPath()}`),
      () =>
        Promise.resolve({
          kind: "redirect",
          location: "https://clerk.example/v1/client/handshake",
          headers,
        }),
      neverRendered,
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://clerk.example/v1/client/handshake");
    expect(response.headers.getSetCookie()).toEqual([
      "__clerk_db_jwt=one; Path=/",
      "__client_uat=0; Path=/",
    ]);
  });

  test("the session's headers ride on the rendered page and on a gate redirect", async () => {
    const headers = new Headers({ "set-cookie": "__session=fresh; Path=/" });

    const rendered = await gateRequest(
      new Request(`${origin}${listPath()}`),
      answers("user_a", headers),
      page,
    );

    const redirected = await gateRequest(
      new Request(`${origin}${listPath()}`),
      answers(null, headers),
      neverRendered,
    );

    expect(rendered.status).toBe(200);
    expect(rendered.headers.getSetCookie()).toEqual(["__session=fresh; Path=/"]);
    expect(await rendered.text()).toBe("page for user_a");
    expect(redirected.headers.getSetCookie()).toEqual(["__session=fresh; Path=/"]);
  });
});
