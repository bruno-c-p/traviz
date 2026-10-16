import countriesData from "@/features/countries/countries.json";
import countryLabels from "@/features/countries/country-labels.json";
import type { Marks, StateColorKey } from "@/lib/colors";

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

export const CONTINENT_ORDER: readonly Continent[] = [
  "Africa",
  "Asia",
  "Europe",
  "North America",
  "South America",
  "Oceania",
  "Antarctica",
];

function toContinent(name: string): Continent {
  const continent = CONTINENT_ORDER.find((candidate) => candidate === name);

  if (!continent) throw new Error(`Unknown continent in countries.json: ${name}`);

  return continent;
}

export const countries: readonly Country[] = countriesData.map((country) => ({
  ...country,
  continent: toContinent(country.continent),
}));

export const COUNTRIES_BY_CODE = new Map<string, Country>(
  countries.map((country) => [country.code, country]),
);

const LABEL_COORDINATES = new Map<string, number[]>(
  countryLabels.map((label) => [label.name, label.coordinates]),
);

export function countryCenter(code: string): [number, number] | null {
  const country = COUNTRIES_BY_CODE.get(code);
  const coordinates = country ? LABEL_COORDINATES.get(country.name) : undefined;

  if (!coordinates || coordinates.length < 2) return null;

  return [coordinates[0], coordinates[1]];
}

function normalizeSearchText(value: string): string {
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
    .flatMap((country) => {
      const rank = matchRank(country.code, normalizedQuery);

      return rank >= 0 ? [{ country, rank }] : [];
    })
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
