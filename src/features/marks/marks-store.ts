import type { CountryState, Marks } from "@/features/marks/colors";
import {
  createMarksOwner,
  type MarksOwner,
  type MarksTransport,
} from "@/features/marks/marks-owner";
import {
  changeScope,
  INITIAL_MARKS_SYNC_STATE,
  visibleMarks,
  type MarksSnapshot,
  type MarksSyncState,
  type SyncProblem,
} from "@/features/marks/marks-sync";
import { createMarksTransport, postWithFetch } from "@/features/marks/marks-transport";
import { createStore } from "@/shared/store";

export type SavingScopes = "all" | readonly string[];

export type MarksStoreState = {
  marks: Marks;
  ownerId: string | null;
  saving: SavingScopes;
  problems: readonly SyncProblem[];
  mark: (code: string, state: CountryState) => void;
  clear: (code: string) => void;
  resetAll: () => void;
  dismissProblem: (scope: string) => void;
  startSession: (ownerId: string) => void;
  endSession: () => void;
  receiveSnapshot: (snapshot: MarksSnapshot) => void;
};

const SAVE_DEADLINE_MS = 8000;

function savingScopes(state: MarksSyncState): SavingScopes {
  const unsaved = state.pending.filter((entry) => entry.phase !== "saved");

  if (unsaved.some((entry) => entry.change.kind === "reset")) return "all";

  return unsaved.map((entry) => changeScope(entry.change));
}

function sameMarks(left: Marks, right: Marks): boolean {
  const codes = Object.keys(left);

  return (
    codes.length === Object.keys(right).length && codes.every((code) => left[code] === right[code])
  );
}

function sameSaving(left: SavingScopes, right: SavingScopes): boolean {
  if (left === "all" || right === "all") return left === right;

  return left.length === right.length && left.every((scope, index) => scope === right[index]);
}

function project(state: MarksSyncState) {
  return {
    marks: visibleMarks(state),
    ownerId: state.ownerId,
    saving: savingScopes(state),
    problems: state.problems,
  };
}

export function createMarksStore(owner: MarksOwner) {
  const store = createStore<MarksStoreState>(() => ({
    ...project(INITIAL_MARKS_SYNC_STATE),
    mark: (code, state) => owner.requestChange({ kind: "set", code, state }),
    clear: (code) => owner.requestChange({ kind: "clear", code }),
    resetAll: () => owner.requestChange({ kind: "reset" }),
    dismissProblem: owner.dismissProblem,
    startSession: owner.startSession,
    endSession: owner.endSession,
    receiveSnapshot: owner.receiveSnapshot,
  }));

  const syncFromOwner = () => {
    const current = store.getState();
    const { marks, ownerId, saving, problems } = project(owner.getState());

    store.setState({
      marks: sameMarks(current.marks, marks) ? current.marks : marks,
      ownerId,
      saving: sameSaving(current.saving, saving) ? current.saving : saving,
      problems,
    });
  };

  owner.subscribe(syncFromOwner);
  syncFromOwner();

  return store;
}

export type MarksStore = ReturnType<typeof createMarksStore>;

export function createBrowserMarksStore(
  transport: MarksTransport,
  startTimer: (callback: () => void, milliseconds: number) => void,
) {
  return createMarksStore(
    createMarksOwner(transport, (onExpired) => {
      startTimer(onExpired, SAVE_DEADLINE_MS);
    }),
  );
}

export const marksStore = createBrowserMarksStore(
  createMarksTransport(postWithFetch),
  (callback, milliseconds) => {
    setTimeout(callback, milliseconds);
  },
);

export function endMarksSession() {
  marksStore.getState().endSession();
}
