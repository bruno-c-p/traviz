"use client";

import { Search } from "lucide-react";
import { CountrySearchResults } from "@/features/globe/country-search-results";
import { useCountrySearch } from "@/features/globe/use-country-search";
import { cn } from "@/shared/cn";

export function CountrySearch({ className }: { className?: string }) {
  const search = useCountrySearch();

  return (
    <div className={cn("relative", className)}>
      <Search
        aria-hidden
        className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-mute"
      />
      <input
        type="text"
        role="combobox"
        aria-label="Find a country"
        aria-expanded={search.showResults}
        aria-controls={search.listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          search.activeCountry ? `${search.listboxId}-${search.activeCountry.code}` : undefined
        }
        value={search.query}
        placeholder="Find a country"
        autoComplete="off"
        onChange={(event) => search.updateQuery(event.target.value)}
        onFocus={() => search.setIsOpen(true)}
        onBlur={() => search.setIsOpen(false)}
        onKeyDown={search.handleKeyDown}
        className="h-12 w-full rounded-full border border-line bg-canvas pl-11 pr-4 text-[15px] text-ink shadow-float placeholder:text-mute focus:border-ink focus:outline-none focus:ring-2 focus:ring-primary"
      />
      {search.showResults && (
        <CountrySearchResults
          listboxId={search.listboxId}
          query={search.query}
          results={search.results}
          activeIndex={search.activeIndex}
          onActivate={search.setActiveIndex}
          onChoose={search.choose}
        />
      )}
    </div>
  );
}
