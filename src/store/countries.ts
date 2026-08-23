import { create } from "zustand";
import type { CountryState, Marks } from "@/lib/colors";
import { clearMarksAction } from "@/features/marks/actions/clear-marks";
import { saveMarksAction } from "@/features/marks/actions/save-marks";

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

let syncInFlight = false;
let syncQueued = false;

function scheduleSync(payload: Marks): void {
  if (syncInFlight) {
    syncQueued = true;
    return;
  }
  void runSync(payload);
}

async function runSync(payload: Marks): Promise<void> {
  syncInFlight = true;
  try {
    await saveMarksAction(payload);
    useCountriesStore.setState({ syncError: null });
  } catch (error) {
    useCountriesStore.setState({ syncError: errorMessage(error) });
  } finally {
    syncInFlight = false;
    if (syncQueued) {
      syncQueued = false;
      const latest = useCountriesStore.getState().marks;
      void runSync(latest);
    }
  }
}

export const useCountriesStore = create<CountriesState>()((set, get) => ({
  marks: {},
  status: "idle",
  syncError: null,

  mark: (code, state) => {
    const marks = { ...get().marks, [code]: state };
    set({ marks });
    scheduleSync(marks);
  },

  clear: (code) => {
    const marks = omit(get().marks, code);
    set({ marks });
    scheduleSync(marks);
  },

  toggle: (code, state) => {
    const marks =
      get().marks[code] === state ? omit(get().marks, code) : { ...get().marks, [code]: state };
    set({ marks });
    scheduleSync(marks);
  },

  resetAll: () => {
    set({ marks: {} });
    clearMarksAction().catch((error: unknown) => {
      set({ syncError: errorMessage(error) });
    });
  },

  clearLocal: () => {
    syncQueued = false;
    set({ marks: {}, status: "idle", syncError: null });
  },
}));
