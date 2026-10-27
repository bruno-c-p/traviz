import "client-only";
import { create } from "zustand";
import type { CountryState, Marks } from "@/features/marks/colors";
import { applyMarkChange } from "@/features/marks/actions/apply-mark-change";
import { readMarks } from "@/features/marks/actions/read-marks";
import { createMarksCache } from "@/features/marks/marks-cache";
import {
  createMarksOwner,
  type MarksOwner,
  type MarksTransport,
} from "@/features/marks/marks-owner";
import {
  changeScope,
  INITIAL_MARKS_SYNC_STATE,
  supersedesSeed,
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
  supersedesSeed: boolean;
  mark: (code: string, state: CountryState) => void;
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
    supersedesSeed: supersedesSeed(state),
  };
}

export function createMarksStore(owner: MarksOwner) {
  const store = create<MarksStoreState>()(() => ({
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
    const { marks, ownerId, saving, problems, supersedesSeed } = project(owner.getState());
    const keptMarks = sameMarks(current.marks, marks) ? current.marks : marks;
    const keptSaving = sameSaving(current.saving, saving) ? current.saving : saving;

    if (
      keptMarks === current.marks &&
      ownerId === current.ownerId &&
      keptSaving === current.saving &&
      problems === current.problems &&
      supersedesSeed === current.supersedesSeed
    ) {
      return;
    }

    store.setState({ marks: keptMarks, ownerId, saving: keptSaving, problems, supersedesSeed });
  };

  owner.subscribe(syncFromOwner);
  syncFromOwner();

  return store;
}

type BrowserMarksDependencies = {
  readonly cookie: () => string;
  readonly storage: () => Storage;
  readonly startTimer: (callback: () => void, milliseconds: number) => void;
  readonly transport: MarksTransport;
};

export function createBrowserMarksStore({
  cookie,
  storage,
  startTimer,
  transport,
}: BrowserMarksDependencies) {
  const owner = createMarksOwner(transport, createMarksCache(storage), (onExpired) => {
    startTimer(onExpired, 8000);
  });

  owner.previewCache((ownerId) => isSignedInAs(cookie(), ownerId));

  return createMarksStore(owner);
}

export const useCountriesStore = createBrowserMarksStore({
  cookie: () => (typeof document === "undefined" ? "" : document.cookie),
  storage: () => localStorage,
  startTimer: (callback, milliseconds) => {
    setTimeout(callback, milliseconds);
  },
  transport: { applyMarkChange, readMarks },
});

export function endMarksSession() {
  useCountriesStore.getState().endSession();
}
