import type { Marks } from "@/lib/colors";

export type Continent =
  | "Africa"
  | "Asia"
  | "Europe"
  | "North America"
  | "South America"
  | "Oceania"
  | "Antarctica";

export interface Country {
  code: string;
  name: string;
  flag: string;
  continent: Continent;
  counted: boolean;
}

const CONTINENTS: readonly Continent[] = [
  "Africa",
  "Asia",
  "Europe",
  "North America",
  "South America",
  "Oceania",
  "Antarctica",
];

export interface StateCounts {
  visited: number;
  want: number;
  not_interested: number;
}

export interface ContinentStats extends StateCounts {
  total: number;
  countedTotal: number;
  countedVisited: number;
}

export interface Stats {
  headline: { visited: number; total: number };
  totals: StateCounts;
  byContinent: Record<Continent, ContinentStats>;
}

function emptyStateCounts(): StateCounts {
  return { visited: 0, want: 0, not_interested: 0 };
}

export function computeStats(marks: Marks, countries: readonly Country[]): Stats {
  const totals = emptyStateCounts();
  const byContinent = Object.fromEntries(
    CONTINENTS.map((continent) => [
      continent,
      { ...emptyStateCounts(), total: 0, countedTotal: 0, countedVisited: 0 },
    ]),
  ) as Record<Continent, ContinentStats>;

  let headlineVisited = 0;
  let headlineTotal = 0;

  for (const country of countries) {
    const state = marks[country.code];
    const continentStats = byContinent[country.continent];
    continentStats.total += 1;

    if (country.counted) {
      headlineTotal += 1;
      continentStats.countedTotal += 1;
    }

    if (state) {
      totals[state] += 1;
      continentStats[state] += 1;
      if (state === "visited" && country.counted) {
        headlineVisited += 1;
        continentStats.countedVisited += 1;
      }
    }
  }

  return {
    headline: { visited: headlineVisited, total: headlineTotal },
    totals,
    byContinent,
  };
}
