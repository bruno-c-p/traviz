import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { redirectFor } from "@/shared/route-gate";

export default clerkMiddleware(async (auth, request) => {
  if (request.method === "POST" && request.headers.has("next-action")) return;

  const { isAuthenticated } = await auth();
  const redirectPath = redirectFor(request.nextUrl.pathname, isAuthenticated);

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
