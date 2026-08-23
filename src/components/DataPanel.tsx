"use client";

import { AlertTriangle, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient, useAuthSession } from "@/lib/authClient";
import { useCountriesStore } from "@/store/countries";

export function DataPanel() {
  const router = useRouter();
  const { data: session } = useAuthSession();
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
    await authClient.signOut();
    setSigningOut(false);
    router.refresh();
  }

  return (
    <>
      <h1 className="px-6 pt-6 text-lg font-semibold text-ink">Data</h1>

      <div className="flex flex-col gap-8 px-6 py-6">
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-body">Account</h2>
          <p className="mb-3 text-sm text-body">
            Your marks are stored in your account. Sign in on any device to pick up where you left
            off.
          </p>
          <div className="flex items-center justify-between gap-3 rounded-lg bg-canvas-soft px-3 py-2 shadow-sm">
            <span className="min-w-0 truncate text-sm text-ink">{session?.user.email ?? ""}</span>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex shrink-0 items-center gap-2 rounded-lg bg-canvas px-3 py-1.5 text-sm text-body hover:bg-primary-pale disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" />
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>

          {syncError && (
            <div className="mt-3 rounded-lg bg-warning px-3 py-2 text-sm text-warning-content">
              Couldn't sync your latest changes: {syncError}
            </div>
          )}
        </section>

        <section className="rounded-xl bg-negative-bg p-4">
          <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-negative">
            <AlertTriangle className="h-3.5 w-3.5" />
            Danger zone
          </h2>
          <p className="mb-3 text-sm text-canvas-soft">
            Permanently erase every mark. This cannot be undone.
          </p>

          {!confirmingReset ? (
            <button
              type="button"
              onClick={() => setConfirmingReset(true)}
              className="rounded-xl bg-negative px-3 py-2 text-sm font-semibold text-canvas hover:bg-negative-deep"
            >
              Reset all data
            </button>
          ) : (
            <div className="flex flex-col gap-2 rounded-lg bg-negative-deep/40 p-3">
              <p className="text-sm text-canvas">
                Are you sure? All marks will be permanently deleted.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleResetConfirmed}
                  className="rounded-lg bg-negative px-3 py-1.5 text-sm font-semibold text-canvas hover:bg-negative-deep"
                >
                  Yes, erase everything
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingReset(false)}
                  className="rounded-lg bg-canvas-soft px-3 py-1.5 text-sm text-ink hover:bg-canvas"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {resetDone && <p className="mt-3 text-sm text-canvas-soft">All data has been reset.</p>}
        </section>
      </div>
    </>
  );
}
