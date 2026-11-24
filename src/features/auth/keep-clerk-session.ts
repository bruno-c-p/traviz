import { clerkSession } from "@/features/auth/clerk-session";
import { hasActiveClient, hasSessionChanged } from "@/features/auth/session-cookies";
import { marksStore } from "@/features/marks";

function reloadForNewSession() {
  marksStore.getState().endSession();
  window.location.reload();
}

function reloadWhenSessionChanged() {
  const ownerId = marksStore.getState().ownerId;

  const check = () => {
    if (document.visibilityState !== "visible") return;

    if (hasSessionChanged(document.cookie, ownerId, (text) => atob(text))) reloadForNewSession();
  };

  document.addEventListener("visibilitychange", check);
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) check();
  });
}

export function keepClerkSession() {
  if (!import.meta.env.PUBLIC_CLERK_PUBLISHABLE_KEY) return;

  window.__internal_onAfterSetActive = reloadForNewSession;

  if (hasActiveClient(document.cookie)) reloadWhenSessionChanged();

  clerkSession.loadAfterPage();
}
