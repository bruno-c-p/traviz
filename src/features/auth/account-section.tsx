"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import { signInPath } from "@/paths";
import { endMarksSession } from "@/features/marks";
import { clerkSession } from "@/features/auth/clerk-session";
import { useAccountEmail } from "@/features/auth/use-account-email";

export function AccountSection() {
  const email = useAccountEmail();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);

  async function handleSignOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    setSignOutFailed(false);

    try {
      await clerkSession.signOut(signInPath(), endMarksSession);
    } catch {
      setIsSigningOut(false);
      setSignOutFailed(true);
    }
  }

  return (
    <section aria-label="Signed in as" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 rounded-full bg-canvas-soft py-1.5 pl-4 pr-1.5">
        <span className="min-w-0 truncate text-sm font-medium text-ink">{email ?? ""}</span>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="pressable flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-canvas px-4 text-sm font-semibold text-ink hover:bg-land focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LogOut size={16} aria-hidden />
          {isSigningOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
      <p className="text-sm leading-relaxed text-body">
        Your marks sync to this account. Sign in on any device to pick up where you left off.
      </p>
      {signOutFailed && (
        <p role="alert" className="text-sm text-negative-text">
          Couldn't sign out. Check your connection and try again.
        </p>
      )}
    </section>
  );
}
