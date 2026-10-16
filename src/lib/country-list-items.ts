import { CONTINENT_ORDER } from "@/features/countries";
import type { Continent, Country } from "@/features/countries";

export type ListItem =
  | { type: "header"; continent: Continent; count: number }
  | { type: "row"; country: Country };

function groupByContinent(countryPool: readonly Country[]): Map<Continent, Country[]> {
  const byContinent = new Map<Continent, Country[]>();

  for (const country of countryPool) {
    const bucket = byContinent.get(country.continent);

    if (bucket) {
      bucket.push(country);
    } else {
      byContinent.set(country.continent, [country]);
    }
  }

  return byContinent;
}

export function buildListItems(
  countryPool: readonly Country[],
  searchResults: readonly Country[] | null,
): ListItem[] {
  if (searchResults) {
    return searchResults.map((country) => ({ type: "row", country }));
  }

  const byContinent = groupByContinent(countryPool);
  const flatItems: ListItem[] = [];

  for (const continent of CONTINENT_ORDER) {
    const continentCountries = byContinent.get(continent);

    if (!continentCountries || continentCountries.length === 0) continue;
    flatItems.push({ type: "header", continent, count: continentCountries.length });

    for (const country of continentCountries) {
      flatItems.push({ type: "row", country });
    }
  }

  return flatItems;
}
