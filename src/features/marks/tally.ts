import type { StateColorKey } from "@/features/marks/colors";

export type Tally = Record<StateColorKey, number>;

function isTallyKey(tally: Tally, key: string): key is StateColorKey {
  return Object.hasOwn(tally, key);
}

export function tallyMarks(
  pool: readonly { code: string }[],
  marks: Readonly<Record<string, string>>,
): Tally {
  const tally: Tally = {
    visited: 0,
    want: 0,
    not_interested: 0,
    unmarked: 0,
  };

  for (const country of pool) {
    const state = marks[country.code];

    tally[state !== undefined && isTallyKey(tally, state) ? state : "unmarked"] += 1;
  }

  return tally;
}

export function tallyTotal(tally: Tally): number {
  return tally.visited + tally.want + tally.not_interested + tally.unmarked;
}

export function tallyShare(tally: Tally, key: StateColorKey): number {
  const total = tallyTotal(tally);

  return total > 0 ? (tally[key] / total) * 100 : 0;
}
