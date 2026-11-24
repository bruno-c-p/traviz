import { describe, expect, test } from "bun:test";
import { hasActiveClient, hasSessionChanged, sessionOwner } from "@/features/auth/session-cookies";

const decodeBase64 = (text: string) => atob(text);

const encodeClaims = (claims: string) =>
  btoa(claims).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

const tokenWith = (claims: string) =>
  `${encodeClaims(JSON.stringify({ alg: "RS256" }))}.${encodeClaims(claims)}.signature`;

const sessionToken = (subject: string) =>
  tokenWith(JSON.stringify({ azp: "https://traviz.example", sub: subject, exp: 1 }));

describe("hasActiveClient", () => {
  test("is true for a development or production client cookie with a time in it", () => {
    expect(hasActiveClient("__client_uat=1795555245")).toBe(true);
    expect(hasActiveClient("theme=dark; __client_uat_AbCd1234=1795555245")).toBe(true);
  });

  test("is false when Clerk wrote zero, or wrote nothing", () => {
    expect(hasActiveClient("__client_uat=0; __client_uat_AbCd1234=0")).toBe(false);
    expect(hasActiveClient("theme=dark")).toBe(false);
    expect(hasActiveClient("")).toBe(false);
  });

  test("ignores a cookie that only ends with the name", () => {
    expect(hasActiveClient("not__client_uat=1795555245")).toBe(false);
  });
});

describe("sessionOwner", () => {
  test("reads the user from the plain or the suffixed session cookie", () => {
    expect(sessionOwner(`__session=${sessionToken("user_ada")}`, "user_ada", decodeBase64)).toBe(
      "same",
    );
    expect(
      sessionOwner(
        `a=b; __session_AbCd1234=${sessionToken("user_grace")}; c=d`,
        "user_ada",
        decodeBase64,
      ),
    ).toBe("other");
  });

  test("trusts the suffixed cookie over a plain one another instance left behind", () => {
    const cookie = `__session=${sessionToken("user_old")}; __session_AbCd1234=${sessionToken("user_ada")}`;

    expect(sessionOwner(cookie, "user_ada", decodeBase64)).toBe("same");
    expect(sessionOwner(cookie, "user_old", decodeBase64)).toBe("other");
  });

  test("reads the top-level subject, not the actor's, in an impersonation token", () => {
    const token = tokenWith(JSON.stringify({ act: { sub: "user_admin" }, sub: "user_ada" }));

    expect(sessionOwner(`__session=${token}`, "user_ada", decodeBase64)).toBe("same");
  });

  test("is none with no session cookie, a cookie that is no token, or a payload that will not decode", () => {
    expect(sessionOwner("__client_uat=1", "user_ada", decodeBase64)).toBe("none");
    expect(sessionOwner("__session=opaque", "user_ada", decodeBase64)).toBe("none");
    expect(sessionOwner("__session=a.%%%.c", "user_ada", decodeBase64)).toBe("none");
    expect(sessionOwner(`__session=a.${btoa("[1]")}.c`, "user_ada", decodeBase64)).toBe("none");
    expect(
      sessionOwner("__session=a.b.c", "user_ada", () => {
        throw new Error("not base64");
      }),
    ).toBe("none");
  });
});

describe("hasSessionChanged", () => {
  const active = "__client_uat=1795555245";

  test("is true once Clerk says the client has no session", () => {
    expect(hasSessionChanged("__client_uat=0", "user_ada", decodeBase64)).toBe(true);
    expect(hasSessionChanged("", "user_ada", decodeBase64)).toBe(true);
  });

  test("is true when the session cookie belongs to another user", () => {
    const cookie = `${active}; __session=${sessionToken("user_grace")}`;

    expect(hasSessionChanged(cookie, "user_ada", decodeBase64)).toBe(true);
  });

  test("is false for the same user", () => {
    const cookie = `${active}; __session=${sessionToken("user_ada")}`;

    expect(hasSessionChanged(cookie, "user_ada", decodeBase64)).toBe(false);
  });

  test("is false while the short-lived session cookie is missing, because Clerk renews it", () => {
    expect(hasSessionChanged(active, "user_ada", decodeBase64)).toBe(false);
  });

  test("is false when the page has no owner to compare with", () => {
    const cookie = `${active}; __session=${sessionToken("user_grace")}`;

    expect(hasSessionChanged(cookie, null, decodeBase64)).toBe(false);
  });
});
