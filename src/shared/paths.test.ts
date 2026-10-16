import { describe, expect, test } from "bun:test";
import { Glob } from "bun";
import {
  ROUTES,
  decideGate,
  homePath,
  listPath,
  routeAccess,
  signInPath,
  signInVerifyPath,
  statsPath,
} from "@/paths";

const appDirectory = new URL("../app/", import.meta.url).pathname;

const routePathOf = (file: string): string => {
  const segments = file
    .split("/")
    .slice(0, -1)
    .filter((segment) => !segment.startsWith("("));

  return `/${segments.join("/")}`;
};

const filesystemRoutes = (): string[] =>
  [...new Glob("**/{page.tsx,route.ts}").scanSync(appDirectory)].map(routePathOf).sort();

describe("ROUTES", () => {
  test("has exactly one row for every page and route handler under src/app", () => {
    expect(ROUTES.map((route) => route.path).sort()).toEqual(filesystemRoutes());
  });
});

describe("decideGate", () => {
  const cases: { pathname: string; isAuthenticated: boolean; redirect: string | undefined }[] = [
    { pathname: homePath(), isAuthenticated: false, redirect: signInPath() },
    { pathname: listPath(), isAuthenticated: false, redirect: signInPath() },
    { pathname: statsPath(), isAuthenticated: false, redirect: signInPath() },
    { pathname: signInPath(), isAuthenticated: false, redirect: undefined },
    { pathname: signInVerifyPath(), isAuthenticated: false, redirect: undefined },
    { pathname: homePath(), isAuthenticated: true, redirect: undefined },
    { pathname: listPath(), isAuthenticated: true, redirect: undefined },
    { pathname: statsPath(), isAuthenticated: true, redirect: undefined },
    { pathname: signInPath(), isAuthenticated: true, redirect: homePath() },
    { pathname: signInVerifyPath(), isAuthenticated: true, redirect: undefined },
    { pathname: "/unknown", isAuthenticated: false, redirect: signInPath() },
    { pathname: "/sign-in/unknown", isAuthenticated: false, redirect: signInPath() },
    { pathname: "/unknown", isAuthenticated: true, redirect: undefined },
  ];

  test.each(cases)(
    "$pathname with isAuthenticated=$isAuthenticated redirects to $redirect",
    ({ pathname, isAuthenticated, redirect }) => {
      expect(decideGate(routeAccess(pathname), isAuthenticated)).toBe(redirect);
    },
  );
});
