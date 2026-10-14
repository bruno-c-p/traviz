"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual";
import type { Range } from "@tanstack/react-virtual";
import { Search, X } from "lucide-react";
import { ContinentFilter } from "@/components/continent-filter";
import { CountryRow } from "@/components/country-row";
import { StatusFilters } from "@/components/status-filters";
import type { StateColorKey } from "@/lib/colors";
import { CONTINENT_ORDER, countByState, countries, searchCountries } from "@/lib/countries";
import type { Continent, Country } from "@/lib/stats";
import { useCountriesStore } from "@/store/countries";

const ROW_HEIGHT = 60;
const HEADER_HEIGHT = 40;

type ListItem =
  | { type: "header"; continent: Continent; count: number }
  | { type: "row"; country: Country };

export function CountryList() {
  const marks = useCountriesStore((state) => state.marks);
  const [query, setQuery] = useState("");
  const [selectedContinent, setSelectedContinent] = useState<Continent | null>(null);
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

  const items = useMemo<ListItem[]>(() => {
    if (searchResults) {
      return searchResults.map((country) => ({ type: "row", country }));
    }

    const byContinent = new Map<Continent, Country[]>();
    for (const country of stateFiltered) {
      const bucket = byContinent.get(country.continent);
      if (bucket) {
        bucket.push(country);
      } else {
        byContinent.set(country.continent, [country]);
      }
    }

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
  }, [stateFiltered, searchResults]);

  const headerIndexes = useMemo(() => {
    const indexes: number[] = [];
    items.forEach((item, index) => {
      if (item.type === "header") indexes.push(index);
    });
    return indexes;
  }, [items]);

  const scrollRef = useRef<HTMLElement | null>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  const activeHeaderRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const list = listRef.current;
    const header = headerRef.current;
    if (!list || !header) return;

    scrollRef.current = list.closest<HTMLElement>("[data-panel-scroll]");

    const measure = () => setScrollMargin(list.offsetTop);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  const rangeExtractor = useCallback(
    (range: Range) => {
      const indexes = defaultRangeExtractor(range);
      const activeHeader = headerIndexes.findLast((index) => index <= range.startIndex);
      activeHeaderRef.current = activeHeader ?? null;
      if (activeHeader === undefined || indexes.includes(activeHeader)) return indexes;
      return [activeHeader, ...indexes];
    },
    [headerIndexes],
  );

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => (items[index].type === "header" ? HEADER_HEIGHT : ROW_HEIGHT),
    overscan: 8,
    scrollMargin,
    rangeExtractor,
  });

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 pt-6 md:flex-row md:items-start md:px-6 md:pt-2">
      <ContinentFilter
        layout="sidebar"
        selectedContinent={selectedContinent}
        onSelect={setSelectedContinent}
        className="hidden w-[280px] shrink-0 md:sticky md:top-2 md:flex"
      />

      <section aria-labelledby="country-list-heading" className="flex min-w-0 flex-1 flex-col">
        <div ref={headerRef} className="flex flex-col gap-4 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1
              id="country-list-heading"
              className="text-3xl font-bold tracking-tight text-ink md:text-4xl"
            >
              {selectedContinent ?? "All countries"}
            </h1>
            <div className="relative w-full sm:w-80">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-mute"
              />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search countries"
                aria-label="Search countries"
                autoComplete="off"
                className="h-12 w-full rounded-full border border-line bg-canvas pl-11 pr-12 text-[15px] text-ink placeholder:text-mute focus:border-ink focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-1.5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-mute hover:bg-canvas-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                >
                  <X size={16} aria-hidden />
                </button>
              )}
            </div>
          </div>
          <ContinentFilter
            layout="chips"
            selectedContinent={selectedContinent}
            onSelect={setSelectedContinent}
            className="md:hidden"
          />
          <StatusFilters
            activeFilters={activeFilters}
            counts={stateCounts}
            onToggle={toggleFilter}
          />
        </div>

        <div ref={listRef} className="relative overflow-clip rounded-3xl bg-canvas shadow-card">
          {items.length === 0 ? (
            <p className="px-6 py-12 text-center text-[15px] text-body">
              {searchResults
                ? `No countries match “${trimmedQuery}”.`
                : "No countries match the selected filters."}
            </p>
          ) : (
            <div style={{ height: virtualizer.getTotalSize() }}>
              {virtualItems.map((virtualItem) => {
                const item = items[virtualItem.index];
                const isStuck =
                  item.type === "header" && activeHeaderRef.current === virtualItem.index;

                return (
                  <div
                    key={virtualItem.key}
                    style={{
                      position: isStuck ? "sticky" : "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: virtualItem.size,
                      zIndex: item.type === "header" ? 10 : undefined,
                      transform: isStuck
                        ? undefined
                        : `translateY(${virtualItem.start - scrollMargin}px)`,
                    }}
                  >
                    {item.type === "header" ? (
                      <div className="flex h-full items-center gap-2 bg-canvas-soft/95 px-5 font-mono text-xs uppercase tracking-wider text-mute">
                        <span className="text-ink">{item.continent}</span>
                        <span>{item.count}</span>
                      </div>
                    ) : (
                      <CountryRow country={item.country} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
