import type { Country } from "@/lib/stats";
import { cn } from "@/lib/utils";

type CountrySearchResultsProps = {
  listboxId: string;
  query: string;
  results: Country[];
  activeIndex: number;
  onActivate: (index: number) => void;
  onChoose: (code: string) => void;
};

export function CountrySearchResults({
  listboxId,
  query,
  results,
  activeIndex,
  onActivate,
  onChoose,
}: CountrySearchResultsProps) {
  return (
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
              onChoose(country.code);
            }}
            onMouseEnter={() => onActivate(index)}
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
  );
}
