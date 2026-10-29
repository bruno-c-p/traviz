import { create } from "zustand";
import { SAMPLE_MARKS, pickMark } from "@/features/landing/landing-marks";
import type { Marks } from "@/features/marks";

type FocusRequest = { code: string; id: number };

type LandingState = {
  marks: Marks;
  focus: FocusRequest | null;
  isSample: boolean;
  pick: (code: string) => void;
  clear: () => void;
};

export const useLandingStore = create<LandingState>()((set) => ({
  marks: SAMPLE_MARKS,
  focus: null,
  isSample: true,
  pick: (code) =>
    set((state) => ({
      marks: pickMark(state.marks, code),
      focus: { code, id: (state.focus?.id ?? 0) + 1 },
      isSample: false,
    })),
  clear: () => set({ marks: {}, isSample: false }),
}));
