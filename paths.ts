import type { Route } from "next";

export const homePath = (): Route => "/";
export const signInPath = (): Route => "/sign-in";
export const signInVerifyPath = (): Route => "/sign-in/verify";
export const listPath = (): Route => "/list";
export const statsPath = (): Route => "/stats";
export const accountPath = (): Route => "/stats#account";

export const decoratedPath = (decorateUrl: (url: string) => string, path: Route): Route =>
  decorateUrl(path) as Route;

export type RouteAccess = "signedIn" | "signedOut" | "anyone";

export const ROUTES: readonly { path: Route; access: RouteAccess }[] = [
  { path: homePath(), access: "signedIn" },
  { path: listPath(), access: "signedIn" },
  { path: statsPath(), access: "signedIn" },
  { path: signInPath(), access: "signedOut" },
  { path: signInVerifyPath(), access: "anyone" },
];
