import { COUNTRY_STATES, STATE_LABELS } from "@/features/marks/core";
import type { CountryState, Marks, StateColorKey } from "@/features/marks/core";

export type WallCountry = { code: string; name: string; continent: string; flag: string };

type Tally = Record<StateColorKey, number>;

const LIST_ROWS = 3;

const CELL_ORDER: readonly StateColorKey[] = [...COUNTRY_STATES, "unmarked"];

export function cellStates(tally: Tally): StateColorKey[] {
  return CELL_ORDER.flatMap((state) => Array.from({ length: tally[state] }, () => state));
}

export function listRows(pool: readonly WallCountry[], marks: Marks): readonly WallCountry[] {
  const marked = pool.filter((country) => marks[country.code]).slice(0, LIST_ROWS);

  return marked.length > 0 ? marked : pool.slice(0, LIST_ROWS);
}

export function changedCodes(previous: Marks, next: Marks): string[] {
  const codes = new Set([...Object.keys(previous), ...Object.keys(next)]);

  return [...codes].filter((code) => previous[code] !== next[code]);
}

export function stateSuffix(state: CountryState | undefined): string {
  return state ? `, ${STATE_LABELS[state]}` : "";
}

export function clearLabel(isSample: boolean): string {
  return isSample ? "Clear sample" : "Clear all";
}

export function tallyAnnouncement(tally: Tally, total: number): string {
  return `${tally.visited} of ${total} visited, ${tally.want} want to go, ${tally.not_interested} not interested.`;
}
