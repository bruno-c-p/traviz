"use client";

import {
  COUNTRY_STATES,
  STATE_COLORS,
  STATE_HINTS,
  STATE_LABELS,
  STATE_ON_COLORS,
} from "@/features/marks/colors";
import type { CountryState } from "@/features/marks/colors";
import { STATE_ICONS } from "@/features/marks/state-icons";
import { cn } from "@/shared/cn";
import { useMarkToggle } from "@/features/marks/use-marks";

const TILE_LABELS: Record<CountryState, string> = {
  visited: "Visited",
  want: "Want to go",
  not_interested: "Skip",
};

type MarkChoicesProps = {
  code: string;
  countryName: string;
  layout: "tiles" | "rows";
};

export function MarkChoices({ code, countryName, layout }: MarkChoicesProps) {
  const { shown, toggle } = useMarkToggle(code);
  const isTiles = layout === "tiles";

  return (
    <div
      role="group"
      aria-label={`Mark ${countryName}`}
      className={isTiles ? "grid grid-cols-3 gap-2" : "flex flex-col gap-2"}
    >
      {COUNTRY_STATES.map((countryState) => {
        const Icon = STATE_ICONS[countryState];
        const isActive = shown === countryState;
        const fill = STATE_COLORS[countryState];
        const onFill = STATE_ON_COLORS[countryState];

        return (
          <button
            key={countryState}
            type="button"
            aria-pressed={isActive}
            aria-label={isTiles ? STATE_LABELS[countryState] : undefined}
            onClick={() => toggle(countryState)}
            style={isActive ? { backgroundColor: fill, color: onFill } : undefined}
            className={cn(
              "rounded-[18px] font-semibold pressable",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2",
              !isActive && "bg-canvas-soft text-ink hover:bg-land",
              isTiles
                ? "flex min-h-[76px] flex-col items-center justify-center gap-1.5 px-2 text-[13px]"
                : "flex min-h-16 items-center gap-3.5 py-2.5 pl-2.5 pr-4 text-left",
            )}
          >
            {isTiles ? (
              <>
                <Icon size={20} strokeWidth={2.2} aria-hidden />
                {TILE_LABELS[countryState]}
              </>
            ) : (
              <>
                <span
                  className="flex size-11 shrink-0 items-center justify-center rounded-[14px] transition-colors duration-[160ms] ease-out"
                  style={
                    isActive
                      ? { backgroundColor: "rgb(255 255 255 / 0.35)" }
                      : { backgroundColor: fill, color: onFill }
                  }
                >
                  <Icon size={20} strokeWidth={2.2} aria-hidden />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-base">{STATE_LABELS[countryState]}</span>
                  <span className="text-[13px] font-normal opacity-80">
                    {STATE_HINTS[countryState]}
                  </span>
                </span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
