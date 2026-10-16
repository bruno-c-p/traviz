import { useMemo, useState } from "react";
import type { StateColorKey } from "@/lib/colors";
import { buildListItems } from "@/lib/country-list-items";
import { countByState, countries, searchCountries } from "@/features/countries";
import type { Continent } from "@/features/countries";
import { useCountriesStore } from "@/store/countries";

export function useCountryListItems(
  selectedContinent: Continent | null,
  activeFilters: ReadonlySet<StateColorKey>,
  query: string,
) {
  const marks = useCountriesStore((state) => state.marks);

  const continentPool = useMemo(
    () =>
      selectedContinent
        ? countries.filter((country) => country.continent === selectedContinent)
        : countries,
    [selectedContinent],
  );

  const stateCounts = useMemo(() => countByState(continentPool, marks), [continentPool, marks]);

  const stateFiltered = useMemo(() => {
    if (activeFilters.size === 0) return continentPool;

    return continentPool.filter((country) => activeFilters.has(marks[country.code] ?? "unmarked"));
  }, [continentPool, marks, activeFilters]);

  const trimmedQuery = query.trim();

  const searchResults = useMemo(
    () => (trimmedQuery ? searchCountries(trimmedQuery, stateFiltered) : null),
    [stateFiltered, trimmedQuery],
  );

  const items = useMemo(
    () => buildListItems(stateFiltered, searchResults),
    [stateFiltered, searchResults],
  );

  const emptyMessage = searchResults
    ? `No countries match “${trimmedQuery}”.`
    : "No countries match the selected filters.";

  return { items, stateCounts, emptyMessage };
}

export function useStateFilters() {
  const [activeFilters, setActiveFilters] = useState<ReadonlySet<StateColorKey>>(() => new Set());

  function toggleFilter(value: StateColorKey) {
    setActiveFilters((previousFilters) => {
      const nextFilters = new Set(previousFilters);

      if (nextFilters.has(value)) {
        nextFilters.delete(value);
      } else {
        nextFilters.add(value);
      }

      return nextFilters;
    });
  }

  return { activeFilters, toggleFilter };
}
