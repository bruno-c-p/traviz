import { COUNTRY_RECORDS } from "@/features/countries/countries.generated";
import { normalizeSearchText, searchByName } from "@/features/countries/search-by-name";

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

export const SOVEREIGN_COUNTRIES: readonly Country[] = countries.filter(
  (country) => country.kind === "sovereign",
);

export function countriesInContinent(continent: Continent): readonly Country[] {
  return countries.filter((country) => country.continent === continent);
}

export const COUNTRIES_BY_CODE: ReadonlyMap<string, Country> = new Map(
  countries.map((country) => [country.code, country]),
);

export function countryCenter(code: string): [number, number] | null {
  const country = COUNTRIES_BY_CODE.get(code);

  if (!country) return null;

  const [longitude, latitude] = country.center;

  return [longitude, latitude];
}

const NORMALIZED_NAMES = new Map<string, string>(
  countries.map((country) => [country.code, normalizeSearchText(country.name)]),
);

export function searchCountries(query: string, pool: readonly Country[] = countries): Country[] {
  return searchByName(pool, query, (country) => NORMALIZED_NAMES.get(country.code) ?? "");
}
