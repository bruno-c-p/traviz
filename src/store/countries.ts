import { create } from "zustand";
import type { CountryState, Marks } from "../lib/colors";
import { clearMarks, fetchMarks, saveMarks } from "../lib/marksApi";

export type SyncStatus = "idle" | "loading" | "ready" | "error";

export interface CountriesState {
  marks: Marks;
  status: SyncStatus;
  syncError: string | null;
  mark: (code: string, state: CountryState) => void;
  clear: (code: string) => void;
  toggle: (code: string, state: CountryState) => void;
  resetAll: () => void;
  load: () => Promise<void>;
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
    await saveMarks(payload);
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
    const marks = get().marks[code] === state ? omit(get().marks, code) : { ...get().marks, [code]: state };
    set({ marks });
    scheduleSync(marks);
  },

  resetAll: () => {
    set({ marks: {} });
    clearMarks().catch((error: unknown) => {
      set({ syncError: errorMessage(error) });
    });
  },

  load: async () => {
    set({ status: "loading", syncError: null });
    try {
      const marks = await fetchMarks();
      set({ marks, status: "ready" });
    } catch (error) {
      set({ status: "error", syncError: errorMessage(error) });
    }
  },

  clearLocal: () => {
    syncQueued = false;
    set({ marks: {}, status: "idle", syncError: null });
  },
}));
