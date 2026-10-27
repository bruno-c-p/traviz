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

export type LimitedSection = ListSection & { readonly hiddenCount: number };

export function limitSectionRows(
  sections: readonly ListSection[],
  rowLimit: number,
): LimitedSection[] {
  let remaining = rowLimit;

  return sections.map((section) => {
    const shown = section.countries.slice(0, Math.max(remaining, 0));
    remaining -= shown.length;

    return { ...section, countries: shown, hiddenCount: section.countries.length - shown.length };
  });
}
