import { use } from "react";
import type { CountryState, Marks } from "@/features/marks/colors";
import { useCountriesStore } from "@/features/marks/marks-store";
import { MarksSeedContext } from "@/features/marks/marks-seed";

function useShownMarks<T>(select: (marks: Marks) => T): T {
  const seed = use(MarksSeedContext);
  const stored = useCountriesStore((state) => select(state.marks));
  const supersedesSeed = useCountriesStore((state) => state.supersedesSeed);
  const snapshot = supersedesSeed || seed === null ? null : use(seed);

  return snapshot?.ok ? select(snapshot.marks) : stored;
}

export function useMarks(): Marks {
  return useShownMarks((marks) => marks);
}

export function useMark(code: string): CountryState | undefined {
  return useShownMarks((marks) => marks[code]);
}

export function useMarkToggle(code: string) {
  const shown = useMark(code);
  const mark = useCountriesStore((state) => state.mark);
  const clear = useCountriesStore((state) => state.clear);

  return {
    shown,
    toggle: (state: CountryState) => (shown === state ? clear(code) : mark(code, state)),
  };
}

export function useHasMarksSeed(): boolean {
  return use(MarksSeedContext) !== null;
}
