import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CountryState, Marks } from "@/lib/colors";
import { clearMarksAction } from "@/features/marks/actions/clear-marks";
import { setMarkAction } from "@/features/marks/actions/set-mark";
import { clearMarkAction } from "@/features/marks/actions/clear-mark";
import { MARKS_STORAGE_KEY } from "@/lib/marks-storage";

type SyncStatus = "idle" | "ready" | "error";

interface CountriesState {
  marks: Marks;
  status: SyncStatus;
  syncError: string | null;
  mark: (code: string, state: CountryState) => void;
  clear: (code: string) => void;
  toggle: (code: string, state: CountryState) => void;
  resetAll: () => void;
  syncMarks: (serverMarks: Marks) => void;
  clearLocal: () => void;
}

function omit(marks: Marks, code: string): Marks {
  const next = { ...marks };
  delete next[code];

  return next;
}

function errorMessage(error: Partial<Error>): string {
  return error instanceof Error ? error.message : "Something went wrong syncing your data.";
}

const pendingWrites = new Map<string, Promise<void>>();
const editsBeforeSync = new Map<string, CountryState | undefined>();
let isResetBeforeSync = false;

function scheduleWrite(code: string, write: () => Promise<void>): void {
  const previous = pendingWrites.get(code) ?? Promise.resolve();

  const next = previous
    .then(write)
    .then(() => {
      useCountriesStore.setState({ syncError: null });
    })
    .catch((error) => {
      if (pendingWrites.get(code) === next) editsBeforeSync.delete(code);

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
  if (useCountriesStore.getState().status !== "ready") editsBeforeSync.set(code, state);

  scheduleWrite(code, () => (state ? setMarkAction(code, state) : clearMarkAction(code)));
}

export const useCountriesStore = create<CountriesState>()(
  persist(
    (set, get) => ({
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
        if (get().status !== "ready") {
          editsBeforeSync.clear();
          isResetBeforeSync = true;
        }

        set({ marks: {} });
        clearMarksAction().catch((error) => {
          isResetBeforeSync = false;
          set({ syncError: errorMessage(error) });
        });
      },

      syncMarks: (serverMarks) => {
        const marks = isResetBeforeSync ? {} : { ...serverMarks };

        for (const [code, state] of editsBeforeSync) {
          if (state) {
            marks[code] = state;
          } else {
            delete marks[code];
          }
        }

        editsBeforeSync.clear();
        isResetBeforeSync = false;
        set({ marks, status: "ready" });
      },

      clearLocal: () => {
        pendingWrites.clear();
        editsBeforeSync.clear();
        isResetBeforeSync = false;
        set({ marks: {}, status: "idle", syncError: null });
      },
    }),
    { name: MARKS_STORAGE_KEY, partialize: (state) => ({ marks: state.marks }) },
  ),
);
