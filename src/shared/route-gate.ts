import { ROUTES, homePath, signInPath, welcomePath } from "@/paths";
import type { Route, RouteAccess } from "@/paths";

export const routeAccess = (pathname: string): RouteAccess =>
  ROUTES.find((route) => route.path === pathname)?.access ?? "signedIn";

export const decideGate = (access: RouteAccess, isAuthenticated: boolean): Route | undefined => {
  if (access === "signedIn" && !isAuthenticated) return signInPath();

  if (access === "signedOut" && isAuthenticated) return homePath();

  return undefined;
};

export const redirectFor = (pathname: string, isAuthenticated: boolean): Route | undefined => {
  if (pathname === homePath() && !isAuthenticated) return welcomePath();

  return decideGate(routeAccess(pathname), isAuthenticated);
};

export type GateAuth =
  | { readonly kind: "redirect"; readonly location: string; readonly headers: Headers }
  | { readonly kind: "resolved"; readonly userId: string | null; readonly headers: Headers };

function redirectTo(location: string, headers: Headers): Response {
  const response = new Response(null, { status: 307, headers: { location } });

  headers.forEach((value, name) => response.headers.append(name, value));

  return response;
}

function withHeaders(response: Response, headers: Headers): Response {
  if ([...headers.keys()].length === 0) return response;

  const merged = new Response(response.body, response);

  headers.forEach((value, name) => merged.headers.append(name, value));

  return merged;
}

export async function gateRequest(
  request: Request,
  authenticate: (request: Request) => Promise<GateAuth>,
  render: (userId: string | null) => Promise<Response>,
): Promise<Response> {
  const auth = await authenticate(request);

  if (auth.kind === "redirect") return redirectTo(auth.location, auth.headers);

  const redirectPath = redirectFor(new URL(request.url).pathname, auth.userId !== null);

  if (redirectPath !== undefined) return redirectTo(redirectPath, auth.headers);

  return withHeaders(await render(auth.userId), auth.headers);
}
