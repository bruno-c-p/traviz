"use client";

import { Globe } from "lucide-react";
import { useState } from "react";
import type { SubmitEvent } from "react";
import { authClient } from "../lib/authClient";

type Mode = "signin" | "signup";

const inputClass =
  "w-full rounded-md border border-ink bg-canvas px-4 py-3 text-sm text-ink placeholder:text-mute focus:outline-none focus:ring-2 focus:ring-primary";

export function AuthPanel() {
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function switchMode(next: Mode) {
    if (next === mode || busy) return;
    setMode(next);
    setError(null);
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    const result =
      mode === "signup"
        ? await authClient.signUp.email({ name, email, password })
        : await authClient.signIn.email({ email, password });

    setBusy(false);
    if (result.error) {
      setError(result.error.message ?? "Something went wrong. Please try again.");
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-y-auto bg-canvas-soft px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-on-primary">
            <Globe size={24} />
          </span>
          <h1 className="text-2xl font-black text-ink">Traviz</h1>
          <p className="text-center text-sm text-body">
            Mark the countries you've visited, want to visit, or don't care about — synced to your account.
          </p>
        </div>

        <div className="rounded-xl bg-canvas p-6 shadow-sm">
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-md bg-canvas-soft p-1">
            <button
              type="button"
              onClick={() => switchMode("signin")}
              aria-pressed={mode === "signin"}
              className={[
                "rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
                mode === "signin" ? "bg-canvas text-ink shadow-sm" : "text-mute hover:text-ink",
              ].join(" ")}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => switchMode("signup")}
              aria-pressed={mode === "signup"}
              className={[
                "rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
                mode === "signup" ? "bg-canvas text-ink shadow-sm" : "text-mute hover:text-ink",
              ].join(" ")}
            >
              Create account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {mode === "signup" && (
              <label className="flex flex-col gap-1 text-xs font-semibold text-body">
                Name
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                  placeholder="Your name"
                  className={inputClass}
                />
              </label>
            )}

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

            <label className="flex flex-col gap-1 text-xs font-semibold text-body">
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                placeholder="At least 8 characters"
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
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
