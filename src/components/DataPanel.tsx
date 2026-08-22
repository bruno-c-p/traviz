"use client";

import { AlertTriangle, LogOut } from "lucide-react";
import { useState } from "react";
import { authClient, useAuthSession } from "../lib/authClient";
import { useCountriesStore } from "../store/countries";

export function DataPanel() {
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
  }

  return (
    <>
      <h1 className="px-6 pt-6 text-lg font-semibold text-slate-900">Data</h1>

      <div className="flex flex-col gap-8 px-6 py-6">
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Account</h2>
          <p className="mb-3 text-sm text-slate-600">
            Your marks are stored in your account. Sign in on any device to pick up where you left off.
          </p>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <span className="min-w-0 truncate text-sm text-slate-900">{session?.user.email ?? ""}</span>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" />
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>

          {syncError && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Couldn't sync your latest changes: {syncError}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-rose-200 bg-rose-50 p-4">
          <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-rose-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            Danger zone
          </h2>
          <p className="mb-3 text-sm text-slate-600">Permanently erase every mark. This cannot be undone.</p>

          {!confirmingReset ? (
            <button
              type="button"
              onClick={() => setConfirmingReset(true)}
              className="rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm text-rose-700 hover:bg-rose-100"
            >
              Reset all data
            </button>
          ) : (
            <div className="flex flex-col gap-2 rounded-lg border border-rose-300 bg-rose-100 p-3">
              <p className="text-sm text-rose-800">Are you sure? All marks will be permanently deleted.</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleResetConfirmed}
                  className="rounded-lg bg-rose-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-600"
                >
                  Yes, erase everything
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingReset(false)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {resetDone && <p className="mt-3 text-sm text-slate-600">All data has been reset.</p>}
        </section>
      </div>
    </>
  );
}
