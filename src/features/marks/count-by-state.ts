import type { Marks, StateColorKey } from "@/features/marks/colors";

export function countByState(
  pool: readonly { code: string }[],
  marks: Marks,
): Record<StateColorKey, number> {
  const counts: Record<StateColorKey, number> = {
    visited: 0,
    want: 0,
    not_interested: 0,
    unmarked: 0,
  };

  for (const country of pool) {
    counts[marks[country.code] ?? "unmarked"] += 1;
  }

  return counts;
}
