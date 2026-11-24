import type { MarkChangeFailure, SyncProblem } from "@/features/marks/marks-sync";
import type { SavingScopes } from "@/features/marks/marks-store";

const PROBLEM_TEXT: Record<MarkChangeFailure, string> = {
  unavailable: "Couldn't save",
  rejected: "Couldn't save",
  "signed-out": "Sign in to save",
  "other-account": "Account changed",
};

export type MarkStatus =
  | { readonly kind: "saving"; readonly text: string }
  | { readonly kind: "problem"; readonly text: string };

function isScopeSaving(saving: SavingScopes, scope: string): boolean {
  if (scope === "snapshot") return false;

  return saving === "all" || saving.includes(scope);
}

function problemText(problem: SyncProblem): string {
  return problem.scope === "snapshot"
    ? "Couldn't load your latest marks."
    : PROBLEM_TEXT[problem.reason];
}

export function markStatusText(
  scope: string,
  saving: SavingScopes,
  problems: readonly SyncProblem[],
): MarkStatus | null {
  if (isScopeSaving(saving, scope)) return { kind: "saving", text: "Saving…" };

  const problem = problems.find((candidate) => candidate.scope === scope);

  return problem === undefined ? null : { kind: "problem", text: problemText(problem) };
}
