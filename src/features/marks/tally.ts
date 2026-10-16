import type { Marks, StateColorKey } from "@/features/marks/colors";

export type Tally = Record<StateColorKey, number>;

export function tallyMarks(pool: readonly { code: string }[], marks: Marks): Tally {
  const tally: Tally = {
    visited: 0,
    want: 0,
    not_interested: 0,
    unmarked: 0,
  };

  for (const country of pool) {
    tally[marks[country.code] ?? "unmarked"] += 1;
  }

  return tally;
}

export function tallyTotal(tally: Tally): number {
  return Object.values(tally).reduce((sum, count) => sum + count, 0);
}
