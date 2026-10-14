"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useCountriesStore } from "@/store/countries";

export function AccountSection({ className }: { className?: string }) {
  const router = useRouter();
  const { user } = useUser();
  const { signOut } = useClerk();
  const syncError = useCountriesStore((state) => state.syncError);
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    await signOut();
    setIsSigningOut(false);
    router.refresh();
  }

  return (
    <section
      id="account"
      aria-labelledby="account-heading"
      className={cn(
        "flex scroll-mt-6 flex-col gap-4 rounded-3xl bg-canvas p-5 shadow-card",
        className,
      )}
    >
      <h2 id="account-heading" className="font-mono text-xs uppercase tracking-wider text-mute">
        Account
      </h2>
      <p className="text-[15px] leading-relaxed text-body">
        Your marks sync to your account. Sign in on any device to pick up where you left off.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-canvas-soft py-1.5 pl-4 pr-1.5">
        <span className="min-w-0 truncate text-sm font-medium text-ink">
          {user?.primaryEmailAddress?.emailAddress ?? ""}
        </span>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-canvas px-4 text-sm font-semibold text-ink hover:bg-land focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LogOut size={16} aria-hidden />
          {isSigningOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
      {syncError && (
        <p role="status" className="rounded-2xl bg-warning px-4 py-3 text-sm text-warning-content">
          Couldn't sync your latest changes: {syncError}
        </p>
      )}
    </section>
  );
}
