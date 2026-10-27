"use client";

import { useState } from "react";
import { ContinentFilter } from "@/features/country-list/continent-filter";
import { CountryListHeader } from "@/features/country-list/country-list-header";
import { CountryRows } from "@/features/country-list/country-rows";
import {
  useCountryListItems,
  useStateFilters,
} from "@/features/country-list/use-country-list-items";
import type { Continent } from "@/features/countries";

export function CountryList() {
  const [query, setQuery] = useState("");
  const [selectedContinent, setSelectedContinent] = useState<Continent | null>(null);
  const { activeFilters, toggleFilter } = useStateFilters();

  const { sections, stateCounts, emptyMessage } = useCountryListItems(
    selectedContinent,
    activeFilters,
    query,
  );

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 pt-6 md:flex-row md:items-start md:px-6 md:pt-2">
      <ContinentFilter
        layout="sidebar"
        selectedContinent={selectedContinent}
        onSelect={setSelectedContinent}
        className="hidden w-[280px] shrink-0 md:sticky md:top-2 md:flex"
      />

      <section aria-labelledby="country-list-heading" className="flex min-w-0 flex-1 flex-col">
        <CountryListHeader
          selectedContinent={selectedContinent}
          onSelectContinent={setSelectedContinent}
          query={query}
          onQueryChange={setQuery}
          activeFilters={activeFilters}
          stateCounts={stateCounts}
          onToggleFilter={toggleFilter}
        />
        <CountryRows sections={sections} emptyMessage={emptyMessage} />
      </section>
    </div>
  );
}
