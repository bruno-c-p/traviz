"use client";

import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual";
import type { Range } from "@tanstack/react-virtual";
import { Search, X } from "lucide-react";
import countriesData from "@/data/countries.json";
import type { Continent, Country } from "@/lib/stats";
import { STATE_COLORS } from "@/lib/colors";
import type { StateColorKey } from "@/lib/colors";
import { useCountriesStore } from "@/store/countries";
import { StateButtons } from "@/components/StateButtons";
import { cn } from "@/lib/utils";

const countries = countriesData as Country[];

const CONTINENT_ORDER: readonly Continent[] = [
  "Africa",
  "Asia",
  "Europe",
  "North America",
  "South America",
  "Oceania",
  "Antarctica",
];

const FILTERS: readonly { value: StateColorKey; label: string }[] = [
  { value: "visited", label: "Visited" },
  { value: "want", label: "Want" },
  { value: "not_interested", label: "Not interested" },
  { value: "unmarked", label: "Unmarked" },
];

const ROW_HEIGHT = 45;
const HEADER_HEIGHT = 30;

type ListItem =
  | { type: "header"; continent: Continent; count: number }
  | { type: "row"; country: Country };

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

const normalizedNames = new Map(countries.map((c) => [c.code, normalize(c.name)]));

function matchRank(code: string, query: string): number {
  const name = normalizedNames.get(code)!;
  if (name.startsWith(query)) return 0;
  if (name.includes(query)) return 1;
  return -1;
}

export function CountryList() {
  const marks = useCountriesStore((s) => s.marks);
  const [query, setQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<ReadonlySet<StateColorKey>>(() => new Set());

  function toggleFilter(value: StateColorKey) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  }

  const stateFiltered = useMemo(() => {
    if (activeFilters.size === 0) return countries;
    return countries.filter((c) =>
      activeFilters.has((marks[c.code] ?? "unmarked") as StateColorKey),
    );
  }, [marks, activeFilters]);

  const trimmedQuery = normalize(query.trim());

  const searchResults = useMemo(() => {
    if (!trimmedQuery) return null;
    return stateFiltered
      .map((country) => ({ country, rank: matchRank(country.code, trimmedQuery) }))
      .filter((entry) => entry.rank >= 0)
      .sort((a, b) => a.rank - b.rank || a.country.name.localeCompare(b.country.name))
      .map((entry) => entry.country);
  }, [stateFiltered, trimmedQuery]);

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

    const flat: ListItem[] = [];
    for (const continent of CONTINENT_ORDER) {
      const list = byContinent.get(continent);
      if (!list || list.length === 0) continue;
      flat.push({ type: "header", continent, count: list.length });
      for (const country of list) {
        flat.push({ type: "row", country });
      }
    }
    return flat;
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

  // The list shares the panel's scroll container with the search and filter
  // block above it, so the virtualizer needs that block's height as its scroll
  // margin. Remeasure when the block resizes — the filter chips wrap on narrow
  // viewports, which moves the list down.
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
      const active = headerIndexes.findLast((index) => index <= range.startIndex);
      activeHeaderRef.current = active ?? null;
      if (active === undefined || indexes.includes(active)) return indexes;
      return [active, ...indexes];
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
    <>
      <h1 className="px-6 pt-6 text-lg font-semibold text-ink">List</h1>

      <div ref={headerRef} className="space-y-3 px-4 pt-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" />
          <input
            type="text"
            value={query}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
            placeholder="Search countries…"
            aria-label="Search countries"
            className="w-full rounded-md border border-ink bg-canvas py-2 pl-9 pr-8 text-sm text-ink placeholder:text-mute focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-mute hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((filter) => {
            const active = activeFilters.has(filter.value);
            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => toggleFilter(filter.value)}
                aria-pressed={active}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                  active
                    ? "bg-primary-pale text-positive-deep"
                    : "bg-canvas-soft text-body hover:bg-primary-pale",
                )}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: STATE_COLORS[filter.value] }}
                />
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      <div ref={listRef} className="relative mt-3">
        {items.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-body">
            {searchResults
              ? `No countries match “${query.trim()}”.`
              : "No countries match the selected filters."}
          </p>
        ) : (
          <div style={{ height: virtualizer.getTotalSize() }}>
            {virtualItems.map((virtualItem) => {
              const item = items[virtualItem.index];
              const stuck = item.type === "header" && activeHeaderRef.current === virtualItem.index;

              return (
                <div
                  key={virtualItem.key}
                  style={{
                    position: stuck ? "sticky" : "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: virtualItem.size,
                    zIndex: item.type === "header" ? 10 : undefined,
                    transform: stuck
                      ? undefined
                      : `translateY(${virtualItem.start - scrollMargin}px)`,
                  }}
                >
                  {item.type === "header" ? (
                    <div className="flex h-full items-center bg-canvas-soft/95 px-4 text-xs font-semibold uppercase tracking-wide text-body backdrop-blur-md">
                      {item.continent} <span className="ml-1 text-mute">{item.count}</span>
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
    </>
  );
}

const CountryRow = memo(function CountryRow({ country }: { country: Country }) {
  return (
    <div className="flex h-full items-center gap-3 border-b border-canvas-soft bg-canvas px-4">
      <span className="text-xl leading-none">{country.flag}</span>
      <span className="min-w-0 flex-1 truncate text-sm text-ink">{country.name}</span>
      {!country.counted && (
        <span
          title="Territory — not counted toward the 195 headline"
          className="shrink-0 rounded border border-mute px-1 py-0.5 text-[9px] uppercase leading-none tracking-wide text-body"
        >
          Territory
        </span>
      )}
      <div className="shrink-0">
        <StateButtons code={country.code} size="sm" />
      </div>
    </div>
  );
});
