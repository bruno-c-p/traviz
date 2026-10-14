import countriesData from "@/data/countries.json";
import countryLabels from "@/data/country-labels.json";
import type { Marks, StateColorKey } from "@/lib/colors";
import type { Continent, Country } from "@/lib/stats";

export const countries: readonly Country[] = countriesData as Country[];

export const COUNTRIES_BY_CODE = new Map<string, Country>(
  countries.map((country) => [country.code, country]),
);

export const CONTINENT_ORDER: readonly Continent[] = [
  "Africa",
  "Asia",
  "Europe",
  "North America",
  "South America",
  "Oceania",
  "Antarctica",
];

const LABEL_COORDINATES = new Map<string, number[]>(
  countryLabels.map((label) => [label.name, label.coordinates]),
);

export function countryCenter(code: string): [number, number] | null {
  const country = COUNTRIES_BY_CODE.get(code);
  const coordinates = country ? LABEL_COORDINATES.get(country.name) : undefined;
  if (!coordinates || coordinates.length < 2) return null;
  return [coordinates[0], coordinates[1]];
}

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

const NORMALIZED_NAMES = new Map(
  countries.map((country) => [country.code, normalizeSearchText(country.name)]),
);

function matchRank(code: string, normalizedQuery: string): number {
  const name = NORMALIZED_NAMES.get(code) ?? "";
  if (name.startsWith(normalizedQuery)) return 0;
  if (name.includes(normalizedQuery)) return 1;
  return -1;
}

export function searchCountries(query: string, pool: readonly Country[] = countries): Country[] {
  const normalizedQuery = normalizeSearchText(query.trim());
  if (!normalizedQuery) return [];
  return pool
    .map((country) => ({ country, rank: matchRank(country.code, normalizedQuery) }))
    .filter((entry) => entry.rank >= 0)
    .sort(
      (first, second) =>
        first.rank - second.rank || first.country.name.localeCompare(second.country.name),
    )
    .map((entry) => entry.country);
}

export function countByState(
  pool: readonly Country[],
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
