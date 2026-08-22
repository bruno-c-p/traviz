import { Globe } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { authClient } from "../lib/authClient";

type Mode = "signin" | "signup";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-teal-600/60 focus:outline-none";

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
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
    <div className="fixed inset-0 flex items-center justify-center overflow-y-auto bg-slate-100 px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-lg">
            <Globe size={24} />
          </span>
          <h1 className="text-xl font-semibold text-slate-900">Traviz</h1>
          <p className="text-center text-sm text-slate-600">
            Mark the countries you've visited, want to visit, or don't care about — synced to your account.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => switchMode("signin")}
              aria-pressed={mode === "signin"}
              className={[
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                mode === "signin" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900",
              ].join(" ")}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => switchMode("signup")}
              aria-pressed={mode === "signup"}
              className={[
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                mode === "signup" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900",
              ].join(" ")}
            >
              Create account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {mode === "signup" && (
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
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

            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
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

            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
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
              <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-1 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
