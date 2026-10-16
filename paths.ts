export const homePath = (): string => "/";
export const signInPath = (): string => "/sign-in";
export const signInVerifyPath = (): string => "/sign-in/verify";
export const listPath = (): string => "/list";
export const statsPath = (): string => "/stats";
export const accountPath = (): string => "/stats#account";

export type RouteAccess = "signedIn" | "signedOut" | "anyone";

export const ROUTES: readonly { path: string; access: RouteAccess }[] = [
  { path: homePath(), access: "signedIn" },
  { path: listPath(), access: "signedIn" },
  { path: statsPath(), access: "signedIn" },
  { path: signInPath(), access: "signedOut" },
  { path: signInVerifyPath(), access: "anyone" },
];

export const routeAccess = (pathname: string): RouteAccess =>
  ROUTES.find((route) => route.path === pathname)?.access ?? "signedIn";

export const decideGate = (access: RouteAccess, isAuthenticated: boolean): string | undefined => {
  if (access === "signedIn" && !isAuthenticated) return signInPath();

  if (access === "signedOut" && isAuthenticated) return homePath();

  return undefined;
};
