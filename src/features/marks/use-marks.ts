import { use } from "react";
import { useShallow } from "zustand/react/shallow";
import type { CountryState, Marks } from "@/features/marks/colors";
import { useCountriesStore } from "@/features/marks/marks-store";
import { MarksSeedContext } from "@/features/marks/marks-seed";
import { shownMarks } from "@/features/marks/marks-sync";

function useShownMarks<T>(select: (marks: Marks) => T): T {
  const seed = use(MarksSeedContext);
  const snapshot = seed === null ? null : use(seed);

  return useCountriesStore(
    useShallow((state) => select(shownMarks(snapshot, state.seedCover, state.marks))),
  );
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
