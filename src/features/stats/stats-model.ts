import { COUNTRY_STATES, tallyMarks, tallyShare, tallyTotal } from "@/features/marks/core";
import type { Marks } from "@/features/marks/core";

export type ContinentCodes = {
  readonly continent: string;
  readonly countries: readonly { readonly code: string }[];
};

export type ContinentStats = {
  readonly continent: string;
  readonly countText: string;
  readonly shares: readonly number[];
  readonly summary: string;
};

export type StatsModel = {
  readonly visited: number;
  readonly totalText: string;
  readonly reachableWidth: number;
  readonly visitedOffset: number;
  readonly excluded: number;
  readonly excludedText: string;
  readonly want: number;
  readonly notInterested: number;
  readonly continents: readonly ContinentStats[];
};

export function encodeContinentCodes(pools: readonly ContinentCodes[]): string {
  return new URLSearchParams(
    pools.map((pool) => [pool.continent, pool.countries.map((country) => country.code).join(",")]),
  ).toString();
}

export function decodeContinentCodes(text: string): ContinentCodes[] {
  return [...new URLSearchParams(text)].map(([continent, codes]) => ({
    continent,
    countries: codes
      .split(",")
      .filter((code) => code !== "")
      .map((code) => ({ code })),
  }));
}

function continentStats(pool: ContinentCodes, marks: Marks): ContinentStats {
  const tally = tallyMarks(pool.countries, marks);

  return {
    continent: pool.continent,
    countText: `${tally.visited} / ${tallyTotal(tally)}`,
    shares: COUNTRY_STATES.map((countryState) => tallyShare(tally, countryState)),
    summary: `${tally.want} on the wish list · ${tally.unmarked} unmarked`,
  };
}

export function statsModel(pools: readonly ContinentCodes[], marks: Marks): StatsModel {
  const places = tallyMarks(
    pools.flatMap((pool) => pool.countries),
    marks,
  );

  const excluded = places.not_interested;
  const total = tallyTotal(places) - excluded;
  const percent = total > 0 ? (places.visited / total) * 100 : 0;

  return {
    visited: places.visited,
    totalText: `of ${total} · ${percent.toFixed(1)}%`,
    reachableWidth: total + excluded > 0 ? (total / (total + excluded)) * 100 : 100,
    visitedOffset: percent - 100,
    excluded,
    excludedText: `${excluded} not interested left out`,
    want: places.want,
    notInterested: places.not_interested,
    continents: pools.map((pool) => continentStats(pool, marks)),
  };
}
