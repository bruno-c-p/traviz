import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { homePath, signInPath } from "@/paths";

export default clerkMiddleware(async (auth, request) => {
  const { isAuthenticated } = await auth();
  const isSignInRoute = request.nextUrl.pathname === signInPath();

  if (!isAuthenticated && !isSignInRoute) {
    return NextResponse.redirect(new URL(signInPath(), request.url));
  }
  if (isAuthenticated && isSignInRoute) {
    return NextResponse.redirect(new URL(homePath(), request.url));
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
