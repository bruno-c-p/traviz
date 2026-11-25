import { createStore } from "@/shared/store";
import type { Store } from "@/shared/store";

export interface SelectedCountryState {
  selectedCode: string | null;
  pendingFlyCode: string | null;
  select: (code: string) => void;
  selectAndFly: (code: string) => void;
  takePendingFly: () => string | null;
  clearSelection: () => void;
}

export type SelectionStore = Store<SelectedCountryState>;

export function createSelectionStore(): SelectionStore {
  return createStore<SelectedCountryState>((set, get) => ({
    selectedCode: null,
    pendingFlyCode: null,

    select: (code) => set({ selectedCode: code, pendingFlyCode: null }),

    selectAndFly: (code) => set({ selectedCode: code, pendingFlyCode: code }),

    takePendingFly: () => {
      const code = get().pendingFlyCode;

      if (code) set({ pendingFlyCode: null });

      return code;
    },

    clearSelection: () => set({ selectedCode: null, pendingFlyCode: null }),
  }));
}
