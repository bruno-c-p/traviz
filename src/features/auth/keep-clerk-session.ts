import { clerkSession } from "@/features/auth/clerk-session";

export function keepClerkSession() {
  if (!import.meta.env.PUBLIC_CLERK_PUBLISHABLE_KEY) return;

  window.__internal_onAfterSetActive = () => window.location.reload();
  clerkSession.loadAfterPage();
}
