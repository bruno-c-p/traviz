import { useContinentOptions } from "@/hooks/use-continent-options";
import { STATE_COLORS } from "@/lib/colors";
import type { Continent } from "@/lib/stats";
import { cn } from "@/lib/utils";

type ContinentSidebarProps = {
  selectedContinent: Continent | null;
  onSelect: (continent: Continent | null) => void;
  className?: string;
};

export function ContinentSidebar({
  selectedContinent,
  onSelect,
  className,
}: ContinentSidebarProps) {
  const options = useContinentOptions();

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
              "flex flex-col gap-2 rounded-2xl px-3.5 py-3 text-left pressable",
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
                className="block h-full rounded-full transition-transform duration-300 ease-out"
                style={{
                  transform: `translateX(${percent - 100}%)`,
                  backgroundColor: STATE_COLORS.visited,
                }}
              />
            </span>
          </button>
        );
      })}
    </nav>
  );
}
