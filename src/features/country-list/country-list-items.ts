import { CONTINENT_ORDER } from "@/features/countries";
import type { Continent, Country } from "@/features/countries";

export type ListSection = { continent: Continent | null; countries: readonly Country[] };

export function buildListSections(
  countryPool: readonly Country[],
  searchResults: readonly Country[] | null,
): ListSection[] {
  if (searchResults) {
    return searchResults.length > 0 ? [{ continent: null, countries: searchResults }] : [];
  }

  return CONTINENT_ORDER.flatMap((continent) => {
    const continentCountries = countryPool.filter((country) => country.continent === continent);

    return continentCountries.length > 0 ? [{ continent, countries: continentCountries }] : [];
  });
}
