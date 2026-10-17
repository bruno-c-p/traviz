"use client";

import { X } from "lucide-react";
import type { MarkChangeFailure, SyncProblem } from "@/features/marks/marks-sync";
import { useCountriesStore, type SavingScopes } from "@/features/marks/marks-store";
import { cn } from "@/shared/cn";

const PROBLEM_TEXT: Record<MarkChangeFailure, string> = {
  unavailable: "Couldn't save",
  rejected: "Couldn't save",
  "signed-out": "Sign in to save",
  "other-account": "Account changed",
};

function isScopeSaving(saving: SavingScopes, scope: string): boolean {
  if (scope === "snapshot") return false;

  return saving === "all" || saving.includes(scope);
}

function problemText(problem: SyncProblem): string {
  return problem.scope === "snapshot"
    ? "Couldn't load your latest marks."
    : PROBLEM_TEXT[problem.reason];
}

export function MarkStatus({ scope, className }: { scope: string; className?: string }) {
  const isSaving = useCountriesStore((state) => isScopeSaving(state.saving, scope));

  const problem = useCountriesStore((state) =>
    state.problems.find((candidate) => candidate.scope === scope),
  );

  const dismissProblem = useCountriesStore((state) => state.dismissProblem);

  if (isSaving) {
    return (
      <p role="status" className={cn("text-xs text-mute", className)}>
        Saving…
      </p>
    );
  }

  if (problem === undefined) return null;

  return (
    <p
      role="status"
      className={cn("flex min-w-0 items-center gap-1 text-xs text-negative-deep", className)}
    >
      <span className="min-w-0 truncate">{problemText(problem)}</span>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => dismissProblem(scope)}
        className="pressable flex size-6 shrink-0 items-center justify-center rounded-full hover:bg-canvas-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
      >
        <X size={12} aria-hidden />
      </button>
    </p>
  );
}
