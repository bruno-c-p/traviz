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

export const redirectFor = (pathname: string, isAuthenticated: boolean): Route | undefined =>
  decideGate(routeAccess(pathname), isAuthenticated);

type GateRequest = {
  readonly method: string;
  readonly hasActionHeader: boolean;
  readonly pathname: string;
};

export const gateRequest = async (
  { method, hasActionHeader, pathname }: GateRequest,
  isAuthenticated: () => Promise<boolean>,
): Promise<Route | undefined> => {
  if (method === "POST" && hasActionHeader) return undefined;

  return redirectFor(pathname, await isAuthenticated());
};
