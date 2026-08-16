import { memo, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { Search, X } from "lucide-react";
import countriesData from "../data/countries.json";
import type { Continent, Country } from "../lib/stats";
import { STATE_COLORS } from "../lib/colors";
import type { StateColorKey } from "../lib/colors";
import { useCountriesStore } from "../store/countries";
import { StateButtons } from "./StateButtons";

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

function matchRank(name: string, query: string): number {
  const lower = name.toLowerCase();
  if (lower.startsWith(query)) return 0;
  if (lower.includes(query)) return 1;
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
    return countries.filter((c) => activeFilters.has((marks[c.code] ?? "unmarked") as StateColorKey));
  }, [marks, activeFilters]);

  const trimmedQuery = query.trim().toLowerCase();

  const searchResults = useMemo(() => {
    if (!trimmedQuery) return null;
    return stateFiltered
      .map((country) => ({ country, rank: matchRank(country.name, trimmedQuery) }))
      .filter((entry) => entry.rank >= 0)
      .sort((a, b) => a.rank - b.rank || a.country.name.localeCompare(b.country.name))
      .map((entry) => entry.country);
  }, [stateFiltered, trimmedQuery]);

  const groups = useMemo(() => {
    if (searchResults) return null;
    const byContinent = new Map<Continent, Country[]>();
    for (const country of stateFiltered) {
      const bucket = byContinent.get(country.continent);
      if (bucket) {
        bucket.push(country);
      } else {
        byContinent.set(country.continent, [country]);
      }
    }
    return CONTINENT_ORDER.map((continent) => ({
      continent,
      countries: byContinent.get(continent) ?? [],
    })).filter((group) => group.countries.length > 0);
  }, [stateFiltered, searchResults]);

  return (
    <>
      <h1 className="px-6 pt-6 text-lg font-semibold text-slate-900">List</h1>

      <div className="space-y-3 px-4 pt-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
            placeholder="Search countries…"
            aria-label="Search countries"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-8 text-sm text-slate-900 placeholder:text-slate-500 focus:border-teal-600/60 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
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
                className={[
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                  active
                    ? "border-teal-600/60 bg-teal-50 text-teal-700"
                    : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300",
                ].join(" ")}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATE_COLORS[filter.value] }} />
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3">
        {searchResults ? (
          searchResults.length > 0 ? (
            searchResults.map((country) => <CountryRow key={country.code} country={country} />)
          ) : (
            <p className="px-6 py-8 text-center text-sm text-slate-500">
              No countries match “{query.trim()}”.
            </p>
          )
        ) : groups && groups.length > 0 ? (
          groups.map(({ continent, countries: list }) => (
            <div key={continent}>
              <div className="sticky top-0 z-10 border-y border-slate-100 bg-white/95 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600 backdrop-blur-md">
                {continent} <span className="text-slate-500">{list.length}</span>
              </div>
              {list.map((country) => (
                <CountryRow key={country.code} country={country} />
              ))}
            </div>
          ))
        ) : (
          <p className="px-6 py-8 text-center text-sm text-slate-500">
            No countries match the selected filters.
          </p>
        )}
      </div>
    </>
  );
}

const CountryRow = memo(function CountryRow({ country }: { country: Country }) {
  return (
    <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-2">
      <span className="text-xl leading-none">{country.flag}</span>
      <span className="min-w-0 flex-1 truncate text-sm text-slate-900">{country.name}</span>
      {!country.counted && (
        <span
          title="Territory — not counted toward the 195 headline"
          className="shrink-0 rounded border border-slate-300 px-1 py-0.5 text-[9px] uppercase leading-none tracking-wide text-slate-600"
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
