import type { CountryState, Marks } from "@/features/marks/colors";

export type MarkChange =
  | { readonly kind: "set"; readonly code: string; readonly state: CountryState }
  | { readonly kind: "clear"; readonly code: string }
  | { readonly kind: "reset" };

export type MarkChangeFailure = "signed-out" | "other-account" | "rejected" | "unavailable";

export type MarkChangeResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: MarkChangeFailure };

export type MarksSnapshot =
  | { readonly ok: true; readonly ownerId: string; readonly marks: Marks }
  | { readonly ok: false; readonly ownerId: string };

export type CachedMarks = { readonly ownerId: string; readonly marks: Marks };

export type PendingChange = {
  readonly id: number;
  readonly change: MarkChange;
  readonly phase: "waiting" | "sending" | "saved";
};

export type MarkBase =
  | { readonly source: "empty" }
  | { readonly source: "cache"; readonly marks: Marks }
  | { readonly source: "server"; readonly marks: Marks };

export type SyncProblem = { readonly scope: string; readonly reason: MarkChangeFailure };

export type MarksSyncState = {
  readonly ownerId: string | null;
  readonly base: MarkBase;
  readonly pending: readonly PendingChange[];
  readonly problems: readonly SyncProblem[];
  readonly lastChangeId: number;
  readonly sessionEnded: boolean;
};

export type MarksSyncEvent =
  | {
      readonly type: "session-started";
      readonly ownerId: string;
      readonly cached: CachedMarks | null;
    }
  | { readonly type: "session-ended" }
  | { readonly type: "snapshot-received"; readonly snapshot: MarksSnapshot }
  | { readonly type: "change-requested"; readonly change: MarkChange }
  | { readonly type: "change-sent"; readonly id: number }
  | { readonly type: "change-settled"; readonly id: number; readonly result: MarkChangeResult }
  | { readonly type: "problem-dismissed"; readonly scope: string }
  | {
      readonly type: "late-change-confirmed";
      readonly change: MarkChange;
      readonly problem: SyncProblem;
    };

export const INITIAL_MARKS_SYNC_STATE: MarksSyncState = {
  ownerId: null,
  base: { source: "empty" },
  pending: [],
  problems: [],
  lastChangeId: 0,
  sessionEnded: false,
};

export function applyChange(marks: Marks, change: MarkChange): Marks {
  switch (change.kind) {
    case "set":
      return { ...marks, [change.code]: change.state };
    case "clear":
      return Object.fromEntries(Object.entries(marks).filter(([code]) => code !== change.code));
    case "reset":
      return {};
  }
}

function foldChanges(marks: Marks, pending: readonly PendingChange[]): Marks {
  return pending.reduce((folded, entry) => applyChange(folded, entry.change), marks);
}

function baseMarks(base: MarkBase): Marks {
  return base.source === "empty" ? {} : base.marks;
}

export function visibleMarks(state: MarksSyncState): Marks {
  return foldChanges(baseMarks(state.base), state.pending);
}

export function snapshotFromMarks(ownerId: string, marks: Promise<Marks>): Promise<MarksSnapshot> {
  return marks.then(
    (loaded): MarksSnapshot => ({ ok: true, ownerId, marks: loaded }),
    (): MarksSnapshot => ({ ok: false, ownerId }),
  );
}

export function changeScope(change: MarkChange): string {
  return change.kind === "reset" ? "all-marks" : change.code;
}

function withoutProblem(problems: readonly SyncProblem[], scope: string): readonly SyncProblem[] {
  return problems.filter((problem) => problem.scope !== scope);
}

function withProblem(
  problems: readonly SyncProblem[],
  problem: SyncProblem,
): readonly SyncProblem[] {
  return [...withoutProblem(problems, problem.scope), problem];
}

function withoutChange(pending: readonly PendingChange[], id: number): readonly PendingChange[] {
  return pending.filter((entry) => entry.id !== id);
}

function withPhase(
  pending: readonly PendingChange[],
  id: number,
  phase: PendingChange["phase"],
): readonly PendingChange[] {
  return pending.map((entry) => (entry.id === id ? { ...entry, phase } : entry));
}

function withConfirmedChange(base: MarkBase, change: MarkChange): MarkBase {
  return base.source === "empty"
    ? base
    : { source: base.source, marks: applyChange(base.marks, change) };
}

function startSession(
  state: MarksSyncState,
  ownerId: string,
  cached: CachedMarks | null,
): MarksSyncState {
  if (state.ownerId === ownerId) return state;

  const base: MarkBase =
    cached?.ownerId === ownerId ? { source: "cache", marks: cached.marks } : { source: "empty" };

  const pending = state.ownerId === null ? state.pending : [];

  return { ...state, ownerId, base, pending, problems: [], sessionEnded: false };
}

function endSession(state: MarksSyncState): MarksSyncState {
  return { ...INITIAL_MARKS_SYNC_STATE, lastChangeId: state.lastChangeId, sessionEnded: true };
}

function receiveSnapshot(state: MarksSyncState, snapshot: MarksSnapshot): MarksSyncState {
  if (snapshot.ownerId !== state.ownerId) return state;

  if (!snapshot.ok) {
    return {
      ...state,
      problems: withProblem(state.problems, { scope: "snapshot", reason: "unavailable" }),
    };
  }

  const saved = state.pending.filter((entry) => entry.phase === "saved");

  return {
    ...state,
    base: { source: "server", marks: foldChanges(snapshot.marks, saved) },
    pending: state.pending.filter((entry) => entry.phase !== "saved"),
    problems: withoutProblem(state.problems, "snapshot"),
  };
}

function requestChange(state: MarksSyncState, change: MarkChange): MarksSyncState {
  if (state.sessionEnded) return state;

  const id = state.lastChangeId + 1;

  return {
    ...state,
    pending: [...state.pending, { id, change, phase: "waiting" }],
    lastChangeId: id,
  };
}

function markSent(state: MarksSyncState, id: number): MarksSyncState {
  const oldestUnsaved = state.pending.find((candidate) => candidate.phase !== "saved");

  if (oldestUnsaved?.id !== id || oldestUnsaved.phase !== "waiting") return state;

  return { ...state, pending: withPhase(state.pending, id, "sending") };
}

function settleChange(state: MarksSyncState, id: number, result: MarkChangeResult): MarksSyncState {
  const entry = state.pending.find((candidate) => candidate.id === id);

  if (entry?.phase !== "sending") return state;

  const scope = changeScope(entry.change);

  if (!result.ok) {
    return {
      ...state,
      pending: withoutChange(state.pending, id),
      problems: withProblem(state.problems, { scope, reason: result.reason }),
    };
  }

  return {
    ...state,
    base: withConfirmedChange(state.base, entry.change),
    pending: withPhase(state.pending, id, "saved"),
    problems:
      entry.change.kind === "reset"
        ? state.problems.filter((problem) => problem.scope === "snapshot")
        : withoutProblem(state.problems, scope),
  };
}

export function reduceMarksSync(state: MarksSyncState, event: MarksSyncEvent): MarksSyncState {
  switch (event.type) {
    case "session-started":
      return startSession(state, event.ownerId, event.cached);
    case "session-ended":
      return endSession(state);
    case "snapshot-received":
      return receiveSnapshot(state, event.snapshot);
    case "change-requested":
      return requestChange(state, event.change);
    case "change-sent":
      return markSent(state, event.id);
    case "change-settled":
      return settleChange(state, event.id, event.result);
    case "problem-dismissed":
      return { ...state, problems: withoutProblem(state.problems, event.scope) };
    case "late-change-confirmed":
      return {
        ...state,
        base: withConfirmedChange(state.base, event.change),
        problems: state.problems.filter((problem) => problem !== event.problem),
      };
  }
}
