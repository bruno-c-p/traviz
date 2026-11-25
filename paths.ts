export type Route = `/${string}`;

export const homePath = (): Route => "/";
export const welcomePath = (): Route => "/welcome";
export const signInPath = (): Route => "/sign-in";
export const signInVerifyPath = (): Route => "/sign-in/verify";
export const listPath = (): Route => "/list";
export const statsPath = (): Route => "/stats";
export const notFoundPath = (): Route => "/404";
export const globeFragmentPath = (): Route => "/fragments/globe";
export const listFragmentPath = (): Route => "/fragments/list";
export const statsFragmentPath = (): Route => "/fragments/stats";
export const accountMenuFragmentPath = (): Route => "/fragments/account-menu";
export const applyMarkChangePath = (): Route => "/api/marks/apply";
export const readMarksPath = (): Route => "/api/marks/read";

export type RouteAccess = "signedIn" | "signedOut" | "anyone";

export const ROUTES: readonly { path: Route; access: RouteAccess }[] = [
  { path: homePath(), access: "signedIn" },
  { path: listPath(), access: "signedIn" },
  { path: statsPath(), access: "signedIn" },
  { path: globeFragmentPath(), access: "signedIn" },
  { path: listFragmentPath(), access: "signedIn" },
  { path: statsFragmentPath(), access: "signedIn" },
  { path: accountMenuFragmentPath(), access: "anyone" },
  { path: welcomePath(), access: "signedOut" },
  { path: signInPath(), access: "signedOut" },
  { path: signInVerifyPath(), access: "anyone" },
  { path: applyMarkChangePath(), access: "anyone" },
  { path: readMarksPath(), access: "anyone" },
  { path: notFoundPath(), access: "anyone" },
];
