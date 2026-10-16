import { COUNTRY_RECORDS } from "@/features/countries/countries.generated";

export type Continent =
  | "Africa"
  | "Asia"
  | "Europe"
  | "North America"
  | "South America"
  | "Oceania"
  | "Antarctica";

type CountryCode = (typeof COUNTRY_RECORDS)[number]["code"];

export interface Country {
  code: CountryCode;
  name: string;
  flag: string;
  continent: Continent;
  kind: "sovereign" | "territory";
  center: readonly [longitude: number, latitude: number];
  area: number;
  hasGlobeLabel: boolean;
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

export const countries: readonly Country[] = COUNTRY_RECORDS;

export const COUNTRIES_BY_CODE: ReadonlyMap<string, Country> = new Map(
  countries.map((country) => [country.code, country]),
);

export function countryCenter(code: string): [number, number] | null {
  const country = COUNTRIES_BY_CODE.get(code);

  if (!country) return null;

  const [longitude, latitude] = country.center;

  return [longitude, latitude];
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

const NORMALIZED_NAMES = new Map<string, string>(
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
