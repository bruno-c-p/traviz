"use client";

import { useState } from "react";
import type { SubmitEvent } from "react";
import { authClient } from "@/lib/authClient";
import { BrandMark } from "@/components/BrandMark";

const inputClass =
  "w-full rounded-md border border-ink bg-canvas px-4 py-3 text-sm text-ink placeholder:text-mute focus:outline-none focus:ring-2 focus:ring-primary";

export function AuthPanel() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    const result = await authClient.signIn.magicLink({ email, callbackURL: "/" });

    setBusy(false);
    if (result.error) {
      setError(result.error.message ?? "Something went wrong. Please try again.");
      return;
    }
    setSent(true);
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-y-auto bg-canvas-soft px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <BrandMark className="text-primary" />
          <h1 className="text-2xl font-black text-ink">Traviz</h1>
          <p className="text-center text-sm text-body">
            Mark the countries you've visited, want to visit, or don't care about — synced to your
            account.
          </p>
        </div>

        <div className="rounded-xl bg-canvas p-6 shadow-sm">
          {sent ? (
            <p className="text-center text-sm text-body">
              Check <span className="font-semibold text-ink">{email}</span> for a link to sign in.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-xs font-semibold text-body">
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className={inputClass}
                />
              </label>

              {error && (
                <p role="alert" className="rounded-md bg-negative-bg px-3 py-2 text-sm text-canvas">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="mt-1 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-active disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "Sending…" : "Send magic link"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
