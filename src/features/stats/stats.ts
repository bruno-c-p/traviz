import type { Marks } from "@/features/marks";
import type { Continent, Country } from "@/features/countries";

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

function emptyContinentStats(): ContinentStats {
  return { ...emptyStateCounts(), total: 0, countedTotal: 0, countedVisited: 0 };
}

export function computeStats(marks: Marks, countries: readonly Country[]): Stats {
  const totals = emptyStateCounts();

  const byContinent: Record<Continent, ContinentStats> = {
    Africa: emptyContinentStats(),
    Asia: emptyContinentStats(),
    Europe: emptyContinentStats(),
    "North America": emptyContinentStats(),
    "South America": emptyContinentStats(),
    Oceania: emptyContinentStats(),
    Antarctica: emptyContinentStats(),
  };

  let headlineVisited = 0;
  let headlineTotal = 0;

  for (const country of countries) {
    const state = marks[country.code];
    const continentStats = byContinent[country.continent];
    continentStats.total += 1;

    if (country.kind === "sovereign") {
      headlineTotal += 1;
      continentStats.countedTotal += 1;
    }

    if (state) {
      totals[state] += 1;
      continentStats[state] += 1;

      if (state === "visited" && country.kind === "sovereign") {
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
