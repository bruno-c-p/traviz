"use client";

import { useRef, useState } from "react";
import { ContinentFilter } from "@/components/continent-filter";
import { CountryListHeader } from "@/components/country-list-header";
import { VirtualCountryList } from "@/components/virtual-country-list";
import { useCountryListItems, useStateFilters } from "@/hooks/use-country-list-items";
import type { Continent } from "@/features/countries";

export function CountryList() {
  const [query, setQuery] = useState("");
  const [selectedContinent, setSelectedContinent] = useState<Continent | null>(null);
  const { activeFilters, toggleFilter } = useStateFilters();

  const { items, stateCounts, emptyMessage } = useCountryListItems(
    selectedContinent,
    activeFilters,
    query,
  );

  const headerRef = useRef<HTMLDivElement>(null);

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
          headerRef={headerRef}
          selectedContinent={selectedContinent}
          onSelectContinent={setSelectedContinent}
          query={query}
          onQueryChange={setQuery}
          activeFilters={activeFilters}
          stateCounts={stateCounts}
          onToggleFilter={toggleFilter}
        />
        <VirtualCountryList items={items} headerRef={headerRef} emptyMessage={emptyMessage} />
      </section>
    </div>
  );
}
