import type { Route } from "next";
import { ROUTES, homePath, signInPath } from "@/paths";
import type { RouteAccess } from "@/paths";

export const routeAccess = (pathname: string): RouteAccess =>
  ROUTES.find((route) => route.path === pathname)?.access ?? "signedIn";

export const decideGate = (access: RouteAccess, isAuthenticated: boolean): Route | undefined => {
  if (access === "signedIn" && !isAuthenticated) return signInPath();

  if (access === "signedOut" && isAuthenticated) return homePath();

  return undefined;
};

export const redirectFor = (
  pathname: string,
  isAuthenticated: boolean,
  isServerAction: boolean,
): Route | undefined =>
  isServerAction ? undefined : decideGate(routeAccess(pathname), isAuthenticated);
