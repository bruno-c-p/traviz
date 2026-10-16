import { useContinentOptions } from "@/features/country-list/use-continent-options";
import type { Continent } from "@/features/countries";
import { cn } from "@/shared/cn";

type ContinentChipsProps = {
  selectedContinent: Continent | null;
  onSelect: (continent: Continent | null) => void;
  className?: string;
};

export function ContinentChips({ selectedContinent, onSelect, className }: ContinentChipsProps) {
  const options = useContinentOptions();

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
              "flex min-h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium pressable",
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
