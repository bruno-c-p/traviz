import { STATE_COLORS } from "@/lib/colors";
import type { StateColorKey } from "@/lib/colors";
import { cn } from "@/lib/utils";

const FILTERS: readonly { value: StateColorKey; label: string }[] = [
  { value: "visited", label: "Visited" },
  { value: "want", label: "Want to go" },
  { value: "not_interested", label: "Not interested" },
  { value: "unmarked", label: "Unmarked" },
];

type StatusFiltersProps = {
  activeFilters: ReadonlySet<StateColorKey>;
  counts: Record<StateColorKey, number>;
  onToggle: (value: StateColorKey) => void;
};

export function StatusFilters({ activeFilters, counts, onToggle }: StatusFiltersProps) {
  return (
    <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2">
      {FILTERS.map((filter) => {
        const isActive = activeFilters.has(filter.value);
        return (
          <button
            key={filter.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onToggle(filter.value)}
            className={cn(
              "flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-medium pressable",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2",
              isActive ? "bg-ink text-canvas" : "bg-canvas text-body hover:bg-land hover:text-ink",
            )}
          >
            <span
              aria-hidden
              className="size-2.5 rounded-full ring-1 ring-ink/15"
              style={{ backgroundColor: STATE_COLORS[filter.value] }}
            />
            {filter.label}
            <span className={cn("font-mono text-xs", isActive ? "text-primary" : "text-mute")}>
              {counts[filter.value]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
