import { expect, test } from "bun:test";
import { isSignedInAs } from "@/features/marks/session-cookie";

const base64Url = (text: string) =>
  btoa(text).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

const token = (payload: string) =>
  `${base64Url('{"alg":"RS256"}')}.${base64Url(payload)}.signature`;

const sessionFor = (ownerId: string) => token(`{"sid":"sess_1","sub":"${ownerId}","v":2}`);

test("a plain session cookie for the owner answers true", () => {
  expect(isSignedInAs(`theme=dark; __session=${sessionFor("user_a")}`, "user_a")).toBe(true);
});

test("a suffixed session cookie for the owner answers true", () => {
  expect(isSignedInAs(`__session_abc=${sessionFor("user_a")}; theme=dark`, "user_a")).toBe(true);
});

test("a payload whose base64url text uses - and _ answers true", () => {
  const session = token('{"sub":"user_a","n":"???~~~"}');

  expect(session).toMatch(/-.*_|_.*-/);
  expect(isSignedInAs(`__session=${session}`, "user_a")).toBe(true);
});

test("a session cookie for another user answers false", () => {
  expect(isSignedInAs(`__session=${sessionFor("user_b")}`, "user_a")).toBe(false);
});

test("no session cookie answers false", () => {
  expect(isSignedInAs(`theme=dark; session=${sessionFor("user_a")}`, "user_a")).toBe(false);
  expect(isSignedInAs("", "user_a")).toBe(false);
});

test("a malformed token answers false", () => {
  expect(isSignedInAs("__session=not-a-token", "user_a")).toBe(false);
  expect(isSignedInAs(`__session=header.${base64Url("user_a")}.signature`, "user_a")).toBe(false);
  expect(isSignedInAs("__session=header.%%%.signature", "user_a")).toBe(false);
});

test("a subject that only starts with the owner id answers false", () => {
  expect(isSignedInAs(`__session=${sessionFor("user_ab")}`, "user_a")).toBe(false);
});

test("an owner id that only appears in a nested claim answers false", () => {
  const impersonated = token('{"act":{"sub":"user_a"},"sub":"user_b"}');

  expect(isSignedInAs(`__session=${impersonated}`, "user_a")).toBe(false);
});

test("a suffixed session cookie decides over a bare one", () => {
  const cookie = `__session=${sessionFor("user_a")}; __session_abc=${sessionFor("user_b")}`;

  expect(isSignedInAs(cookie, "user_a")).toBe(false);
  expect(isSignedInAs(cookie, "user_b")).toBe(true);
});

test("any of several suffixed session cookies can name the owner", () => {
  const cookie = `__session_abc=${sessionFor("user_b")}; __session_def=${sessionFor("user_a")}`;

  expect(isSignedInAs(cookie, "user_a")).toBe(true);
});
