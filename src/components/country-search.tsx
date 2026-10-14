"use client";

import { Search } from "lucide-react";
import { useId, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import { searchCountries } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { useSelectedCountryStore } from "@/store/selected-country";

const MAX_RESULTS = 6;

export function CountrySearch({ className }: { className?: string }) {
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const selectAndFly = useSelectedCountryStore((state) => state.selectAndFly);

  const results = useMemo(() => searchCountries(query).slice(0, MAX_RESULTS), [query]);
  const showResults = isOpen && query.trim().length > 0;
  const activeCountry = showResults ? results[activeIndex] : undefined;

  function choose(code: string) {
    selectAndFly(code);
    setQuery("");
    setIsOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && activeCountry) {
      event.preventDefault();
      choose(activeCountry.code);
    } else if (event.key === "Escape") {
      setIsOpen(false);
    }
  }

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
        aria-expanded={showResults}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeCountry ? `${listboxId}-${activeCountry.code}` : undefined}
        value={query}
        placeholder="Find a country"
        autoComplete="off"
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        onKeyDown={handleKeyDown}
        className="h-12 w-full rounded-full border border-line bg-canvas pl-11 pr-4 text-[15px] text-ink shadow-float placeholder:text-mute focus:border-ink focus:outline-none focus:ring-2 focus:ring-primary"
      />
      {showResults && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Countries"
          className="absolute inset-x-0 top-full z-50 mt-2 flex flex-col gap-0.5 rounded-2xl bg-canvas p-1.5 shadow-card"
        >
          {results.length === 0 ? (
            <li
              role="option"
              aria-selected={false}
              aria-disabled
              className="px-3 py-3 text-sm text-body"
            >
              No countries match “{query.trim()}”.
            </li>
          ) : (
            results.map((country, index) => (
              <li
                key={country.code}
                id={`${listboxId}-${country.code}`}
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(country.code);
                }}
                onMouseEnter={() => setActiveIndex(index)}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3",
                  index === activeIndex && "bg-canvas-soft",
                )}
              >
                <span className="w-9 shrink-0 font-mono text-xs text-mute">{country.code}</span>
                <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">
                  {country.name}
                </span>
                <span className="shrink-0 text-xs text-mute">{country.continent}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
