import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { StateStorage } from "zustand/middleware";
import type { CountryState, Marks } from "../lib/colors";
import { load, remove, save } from "./storage";

const STORAGE_KEY = "traviz-countries";
const SCHEMA_VERSION = 1;

const stateStorage: StateStorage = {
  getItem: load,
  setItem: save,
  removeItem: remove,
};

function omit(marks: Marks, code: string): Marks {
  const next = { ...marks };
  delete next[code];
  return next;
}

export interface CountriesState {
  marks: Marks;
  mark: (code: string, state: CountryState) => void;
  clear: (code: string) => void;
  toggle: (code: string, state: CountryState) => void;
  replaceAll: (marks: Marks) => void;
  resetAll: () => void;
}

export const useCountriesStore = create<CountriesState>()(
  persist(
    (set) => ({
      marks: {},
      mark: (code, state) => set((s) => ({ marks: { ...s.marks, [code]: state } })),
      clear: (code) => set((s) => ({ marks: omit(s.marks, code) })),
      toggle: (code, state) =>
        set((s) =>
          s.marks[code] === state
            ? { marks: omit(s.marks, code) }
            : { marks: { ...s.marks, [code]: state } },
        ),
      replaceAll: (marks) => set({ marks: { ...marks } }),
      resetAll: () => set({ marks: {} }),
    }),
    {
      name: STORAGE_KEY,
      version: SCHEMA_VERSION,
      storage: createJSONStorage(() => stateStorage),
      partialize: (s) => ({ marks: s.marks }),
    },
  ),
);
