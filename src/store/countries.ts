import { create } from "zustand";
import type { CountryState, Marks } from "@/lib/colors";
import { clearMarksAction } from "@/features/marks/actions/clear-marks";
import { setMarkAction } from "@/features/marks/actions/set-mark";
import { clearMarkAction } from "@/features/marks/actions/clear-mark";

export type SyncStatus = "idle" | "ready" | "error";

export interface CountriesState {
  marks: Marks;
  status: SyncStatus;
  syncError: string | null;
  mark: (code: string, state: CountryState) => void;
  clear: (code: string) => void;
  toggle: (code: string, state: CountryState) => void;
  resetAll: () => void;
  clearLocal: () => void;
}

function omit(marks: Marks, code: string): Marks {
  const next = { ...marks };
  delete next[code];
  return next;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong syncing your data.";
}

const pendingWrites = new Map<string, Promise<void>>();

function scheduleWrite(code: string, write: () => Promise<void>): void {
  const previous = pendingWrites.get(code) ?? Promise.resolve();
  const next = previous
    .then(write)
    .then(() => {
      useCountriesStore.setState({ syncError: null });
    })
    .catch((error: unknown) => {
      useCountriesStore.setState({ syncError: errorMessage(error) });
    })
    .finally(() => {
      if (pendingWrites.get(code) === next) {
        pendingWrites.delete(code);
      }
    });
  pendingWrites.set(code, next);
}

function persistMark(code: string, state: CountryState | undefined): void {
  scheduleWrite(code, () => (state ? setMarkAction(code, state) : clearMarkAction(code)));
}

export const useCountriesStore = create<CountriesState>()((set, get) => ({
  marks: {},
  status: "idle",
  syncError: null,

  mark: (code, state) => {
    set({ marks: { ...get().marks, [code]: state } });
    persistMark(code, state);
  },

  clear: (code) => {
    set({ marks: omit(get().marks, code) });
    persistMark(code, undefined);
  },

  toggle: (code, state) => {
    const isSame = get().marks[code] === state;
    set({ marks: isSame ? omit(get().marks, code) : { ...get().marks, [code]: state } });
    persistMark(code, isSame ? undefined : state);
  },

  resetAll: () => {
    set({ marks: {} });
    clearMarksAction().catch((error: unknown) => {
      set({ syncError: errorMessage(error) });
    });
  },

  clearLocal: () => {
    pendingWrites.clear();
    set({ marks: {}, status: "idle", syncError: null });
  },
}));
