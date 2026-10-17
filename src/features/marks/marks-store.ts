import "client-only";
import { create } from "zustand";
import type { CountryState, Marks } from "@/features/marks/colors";
import { applyMarkChange } from "@/features/marks/actions/apply-mark-change";
import { readMarks } from "@/features/marks/actions/read-marks";
import { createMarksCache } from "@/features/marks/marks-cache";
import { createMarksOwner, type MarksOwner } from "@/features/marks/marks-owner";
import {
  changeScope,
  INITIAL_MARKS_SYNC_STATE,
  visibleMarks,
  type MarksSnapshot,
  type MarksSyncState,
  type SyncProblem,
} from "@/features/marks/marks-sync";
import { isSignedInAs } from "@/features/marks/session-cookie";

export type SavingScopes = "all" | readonly string[];

type MarksStoreState = {
  marks: Marks;
  ownerId: string | null;
  saving: SavingScopes;
  problems: readonly SyncProblem[];
  toggle: (code: string, state: CountryState) => void;
  clear: (code: string) => void;
  resetAll: () => void;
  dismissProblem: (scope: string) => void;
  startSession: (ownerId: string) => void;
  endSession: () => void;
  receiveSnapshot: (snapshot: MarksSnapshot) => void;
};

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
  const store = create<MarksStoreState>()((_set, get) => ({
    ...project(INITIAL_MARKS_SYNC_STATE),
    toggle: (code, state) =>
      owner.requestChange(
        get().marks[code] === state ? { kind: "clear", code } : { kind: "set", code, state },
      ),
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
    const keptMarks = sameMarks(current.marks, marks) ? current.marks : marks;
    const keptSaving = sameSaving(current.saving, saving) ? current.saving : saving;

    if (
      keptMarks === current.marks &&
      ownerId === current.ownerId &&
      keptSaving === current.saving &&
      problems === current.problems
    ) {
      return;
    }

    store.setState({ marks: keptMarks, ownerId, saving: keptSaving, problems });
  };

  owner.subscribe(syncFromOwner);
  syncFromOwner();

  return store;
}

const marksOwner = createMarksOwner(
  { applyMarkChange, readMarks },
  createMarksCache(() => localStorage),
  (onExpired) => {
    setTimeout(onExpired, 8000);
  },
);

if (typeof document !== "undefined") {
  marksOwner.previewCache((ownerId) => isSignedInAs(document.cookie, ownerId));
}

export const useCountriesStore = createMarksStore(marksOwner);

export function endMarksSession() {
  useCountriesStore.getState().endSession();
}
