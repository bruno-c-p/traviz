import { expect, test } from "bun:test";
import { authenticateWith, fixedUserSession } from "@/features/auth/authenticate";
import { missingClerkKeys, parseAuthorizedParties } from "@/features/auth/clerk-session-reader";

const request = new Request("https://traviz.test/list");

test("the fixed user is signed in on every request and sets no headers", async () => {
  const auth = await authenticateWith(fixedUserSession("user_fixed"))(request);

  expect(auth.kind).toBe("resolved");
  expect(auth).toMatchObject({ userId: "user_fixed" });
  expect([...auth.headers.keys()]).toEqual([]);
});

test("a session with a location header becomes a redirect that keeps the other headers", async () => {
  const headers = new Headers({ location: "https://clerk.example/handshake" });

  headers.append("set-cookie", "__clerk_db_jwt=one; Path=/");

  const auth = await authenticateWith(() => Promise.resolve({ userId: null, headers }))(request);

  expect(auth).toMatchObject({ kind: "redirect", location: "https://clerk.example/handshake" });
  expect(auth.headers.has("location")).toBe(false);
  expect(auth.headers.getSetCookie()).toEqual(["__clerk_db_jwt=one; Path=/"]);
  expect(headers.has("location")).toBe(true);
});

test("a session without a location header resolves to its user and headers", async () => {
  const headers = new Headers({ "x-clerk-auth-status": "signed-out" });
  const auth = await authenticateWith(() => Promise.resolve({ userId: null, headers }))(request);

  expect(auth).toMatchObject({ kind: "resolved", userId: null });
  expect(auth.headers.get("x-clerk-auth-status")).toBe("signed-out");
});

test("the Clerk reader names each key that is missing", () => {
  expect(missingClerkKeys({ secretKey: undefined, publishableKey: undefined })).toEqual([
    "CLERK_SECRET_KEY",
    "PUBLIC_CLERK_PUBLISHABLE_KEY",
  ]);
  expect(missingClerkKeys({ secretKey: "sk_test_x", publishableKey: "pk_test_x" })).toEqual([]);
});

test("no authorized parties setting leaves the check to Clerk's default", () => {
  expect(parseAuthorizedParties(undefined)).toBeUndefined();
  expect(parseAuthorizedParties(" , ")).toBeUndefined();
});

test("authorized parties are the listed origins, trimmed", () => {
  expect(parseAuthorizedParties("https://traviz.example, http://localhost:4321")).toEqual([
    "https://traviz.example",
    "http://localhost:4321",
  ]);
});

test("an authorized party that is not a bare origin is refused by name", () => {
  expect(() => parseAuthorizedParties("https://traviz.example/, traviz.example")).toThrow(
    "not https://traviz.example/, traviz.example",
  );
});
