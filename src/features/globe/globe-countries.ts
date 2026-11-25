import { searchByName } from "@/features/countries";
import type { CountryRow } from "@/features/countries";

export type GlobeCountry = CountryRow;

export const MAX_SEARCH_RESULTS = 6;

export function searchGlobeCountries(
  countries: readonly GlobeCountry[],
  query: string,
): GlobeCountry[] {
  return searchByName(countries, query, (country) => country.searchText).slice(
    0,
    MAX_SEARCH_RESULTS,
  );
}

export function countryMeta(country: GlobeCountry): string {
  return `${country.continent} · ${country.code}${country.isTerritory ? " · Territory" : ""}`;
}
