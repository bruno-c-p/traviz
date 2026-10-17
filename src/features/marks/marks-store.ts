import "client-only";
import { create } from "zustand";
import type { CountryState, Marks } from "@/features/marks/colors";
import { applyMarkChange } from "@/features/marks/actions/apply-mark-change";
import { readMarks } from "@/features/marks/actions/read-marks";
import { createMarksCache } from "@/features/marks/marks-cache";
import { createMarksOwner, type MarksOwner } from "@/features/marks/marks-owner";
import {
  changeScope,
  visibleMarks,
  type MarksSnapshot,
  type MarksSyncState,
  type SyncProblem,
} from "@/features/marks/marks-sync";

export type SavingScopes = "all" | readonly string[];

export type MarksStoreState = {
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
    ...project(owner.getState()),
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

  owner.subscribe(() => store.setState(project(owner.getState())));

  return store;
}

export const useCountriesStore = createMarksStore(
  createMarksOwner(
    { applyMarkChange, readMarks },
    createMarksCache(() => localStorage),
    (onExpired) => {
      setTimeout(onExpired, 8000);
    },
  ),
);

export function endMarksSession() {
  useCountriesStore.getState().endSession();
}
