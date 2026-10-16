import { ROUTES, homePath, signInPath } from "@/paths";
import type { RouteAccess } from "@/paths";

export const routeAccess = (pathname: string): RouteAccess =>
  ROUTES.find((route) => route.path === pathname)?.access ?? "signedIn";

export const decideGate = (access: RouteAccess, isAuthenticated: boolean): string | undefined => {
  if (access === "signedIn" && !isAuthenticated) return signInPath();

  if (access === "signedOut" && isAuthenticated) return homePath();

  return undefined;
};

export const redirectFor = (pathname: string, isAuthenticated: boolean): string | undefined =>
  decideGate(routeAccess(pathname), isAuthenticated);
