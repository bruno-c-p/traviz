import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { decideGate, routeAccess } from "@/shared/route-gate";

export default clerkMiddleware(async (auth, request) => {
  const { isAuthenticated } = await auth();
  const redirectPath = decideGate(routeAccess(request.nextUrl.pathname), isAuthenticated);

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
