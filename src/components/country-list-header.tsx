import type { Ref } from "react";
import { ContinentFilter } from "@/components/continent-filter";
import { ListSearchInput } from "@/components/list-search-input";
import { StatusFilters } from "@/components/status-filters";
import type { StateColorKey } from "@/features/marks";
import type { Continent } from "@/features/countries";

type CountryListHeaderProps = {
  headerRef: Ref<HTMLDivElement>;
  selectedContinent: Continent | null;
  onSelectContinent: (continent: Continent | null) => void;
  query: string;
  onQueryChange: (query: string) => void;
  activeFilters: ReadonlySet<StateColorKey>;
  stateCounts: Record<StateColorKey, number>;
  onToggleFilter: (value: StateColorKey) => void;
};

export function CountryListHeader({
  headerRef,
  selectedContinent,
  onSelectContinent,
  query,
  onQueryChange,
  activeFilters,
  stateCounts,
  onToggleFilter,
}: CountryListHeaderProps) {
  return (
    <div ref={headerRef} className="flex flex-col gap-4 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1
          id="country-list-heading"
          className="text-3xl font-bold tracking-tight text-ink md:text-4xl"
        >
          {selectedContinent ?? "All countries"}
        </h1>
        <ListSearchInput query={query} onQueryChange={onQueryChange} />
      </div>
      <ContinentFilter
        layout="chips"
        selectedContinent={selectedContinent}
        onSelect={onSelectContinent}
        className="md:hidden"
      />
      <StatusFilters activeFilters={activeFilters} counts={stateCounts} onToggle={onToggleFilter} />
    </div>
  );
}
