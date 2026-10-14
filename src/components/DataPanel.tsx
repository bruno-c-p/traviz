"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { AlertTriangle, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCountriesStore } from "@/store/countries";

export function DataPanel() {
  const router = useRouter();
  const { user } = useUser();
  const { signOut } = useClerk();
  const syncError = useCountriesStore((s) => s.syncError);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  function handleResetConfirmed() {
    useCountriesStore.getState().resetAll();
    setConfirmingReset(false);
    setResetDone(true);
  }

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
    router.refresh();
  }

  return (
    <>
      <h1 className="px-6 pt-8 text-3xl font-bold tracking-tight text-ink">Data</h1>

      <div className="flex flex-col gap-6 px-4 py-6">
        <section className="rounded-3xl bg-canvas p-5 shadow-card">
          <h2 className="mb-2 font-mono text-xs uppercase tracking-wider text-mute">Account</h2>
          <p className="mb-4 text-[15px] leading-relaxed text-body">
            Your marks are stored in your account. Sign in on any device to pick up where you left
            off.
          </p>
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-canvas-soft py-1.5 pl-4 pr-1.5">
            <span className="min-w-0 truncate text-sm font-medium text-ink">
              {user?.primaryEmailAddress?.emailAddress ?? ""}
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-canvas px-4 text-sm font-semibold text-ink hover:bg-land disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
            >
              <LogOut className="h-4 w-4" />
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>

          {syncError && (
            <div className="mt-3 rounded-2xl bg-warning px-4 py-3 text-sm text-warning-content">
              Couldn't sync your latest changes: {syncError}
            </div>
          )}
        </section>

        <section className="rounded-3xl bg-canvas p-5 shadow-card ring-1 ring-negative/20">
          <h2 className="mb-2 flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-negative-deep">
            <AlertTriangle className="h-3.5 w-3.5" />
            Danger zone
          </h2>
          <p className="mb-4 text-[15px] leading-relaxed text-body">
            Permanently erase every mark. This cannot be undone.
          </p>

          {!confirmingReset ? (
            <button
              type="button"
              onClick={() => setConfirmingReset(true)}
              className="min-h-11 rounded-full bg-negative px-5 text-sm font-semibold text-canvas hover:bg-negative-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
            >
              Reset all data
            </button>
          ) : (
            <div className="flex flex-col gap-3 rounded-2xl bg-negative-pale p-4">
              <p className="text-sm font-medium text-negative-darkest">
                Are you sure? All marks will be permanently deleted.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleResetConfirmed}
                  className="min-h-11 rounded-full bg-negative px-4 text-sm font-semibold text-canvas hover:bg-negative-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
                >
                  Yes, erase everything
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingReset(false)}
                  className="min-h-11 rounded-full bg-canvas px-4 text-sm font-semibold text-ink hover:bg-land focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {resetDone && <p className="mt-3 text-sm text-body">All data has been reset.</p>}
        </section>
      </div>
    </>
  );
}
