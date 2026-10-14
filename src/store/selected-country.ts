import { create } from "zustand";

export type FlyRequest = {
  code: string;
  requestId: number;
};

export interface SelectedCountryState {
  selectedCode: string | null;
  flyRequest: FlyRequest | null;
  select: (code: string) => void;
  selectAndFly: (code: string) => void;
  clearSelection: () => void;
}

export const useSelectedCountryStore = create<SelectedCountryState>()((set, get) => ({
  selectedCode: null,
  flyRequest: null,

  select: (code) => set({ selectedCode: code }),

  selectAndFly: (code) =>
    set({
      selectedCode: code,
      flyRequest: { code, requestId: (get().flyRequest?.requestId ?? 0) + 1 },
    }),

  clearSelection: () => set({ selectedCode: null }),
}));
