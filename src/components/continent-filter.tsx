"use client";

import { STATE_COLORS } from "@/lib/colors";
import { CONTINENT_ORDER, countries } from "@/lib/countries";
import { computeStats } from "@/lib/stats";
import type { Continent } from "@/lib/stats";
import { cn } from "@/lib/utils";
import { useCountriesStore } from "@/store/countries";

type ContinentFilterProps = {
  selectedContinent: Continent | null;
  onSelect: (continent: Continent | null) => void;
  layout: "sidebar" | "chips";
  className?: string;
};

type ContinentOption = {
  continent: Continent | null;
  label: string;
  visited: number;
  total: number;
};

export function ContinentFilter({
  selectedContinent,
  onSelect,
  layout,
  className,
}: ContinentFilterProps) {
  const marks = useCountriesStore((state) => state.marks);
  const stats = computeStats(marks, countries);

  const options: ContinentOption[] = [
    {
      continent: null,
      label: "All countries",
      visited: stats.totals.visited,
      total: countries.length,
    },
    ...CONTINENT_ORDER.map((continent) => ({
      continent,
      label: continent,
      visited: stats.byContinent[continent].visited,
      total: stats.byContinent[continent].total,
    })),
  ];

  if (layout === "chips") {
    return (
      <div
        role="group"
        aria-label="Continent"
        className={cn("-mx-4 flex gap-2 overflow-x-auto px-4 pb-1", className)}
      >
        {options.map((option) => {
          const isActive = option.continent === selectedContinent;
          return (
            <button
              key={option.label}
              type="button"
              aria-pressed={isActive}
              onClick={() => onSelect(option.continent)}
              className={cn(
                "flex min-h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2",
                isActive ? "bg-ink-deep text-canvas" : "bg-canvas text-body hover:text-ink",
              )}
            >
              {option.label}
              <span className={cn("font-mono text-xs", isActive ? "text-primary" : "text-mute")}>
                {option.visited}/{option.total}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <nav
      aria-label="Continents"
      className={cn("flex flex-col gap-1 rounded-3xl bg-canvas p-2.5 shadow-card", className)}
    >
      {options.map((option) => {
        const isActive = option.continent === selectedContinent;
        const percent = option.total > 0 ? (option.visited / option.total) * 100 : 0;
        return (
          <button
            key={option.label}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelect(option.continent)}
            className={cn(
              "flex flex-col gap-2 rounded-2xl px-3.5 py-3 text-left transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink",
              isActive ? "bg-canvas-soft" : "hover:bg-canvas-soft",
            )}
          >
            <span className="flex items-baseline justify-between gap-3">
              <span
                className={cn("text-[15px] text-ink", isActive ? "font-semibold" : "font-medium")}
              >
                {option.label}
              </span>
              <span className="font-mono text-xs tabular-nums text-mute">
                {option.visited} / {option.total}
              </span>
            </span>
            <span className="block h-1.5 overflow-hidden rounded-full bg-land">
              <span
                className="block h-full rounded-full"
                style={{ width: `${percent}%`, backgroundColor: STATE_COLORS.visited }}
              />
            </span>
          </button>
        );
      })}
    </nav>
  );
}
