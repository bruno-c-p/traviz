import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { gateRequest } from "@/shared/route-gate";

export default clerkMiddleware(async (auth, request) => {
  const redirectPath = await gateRequest(
    {
      method: request.method,
      hasActionHeader: request.headers.has("next-action"),
      pathname: request.nextUrl.pathname,
    },
    async () => (await auth()).isAuthenticated,
  );

  if (redirectPath !== undefined) {
    return NextResponse.redirect(new URL(redirectPath, request.url));
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
