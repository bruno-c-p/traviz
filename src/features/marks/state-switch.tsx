"use client";

import {
  COUNTRY_STATES,
  STATE_COLORS,
  STATE_LABELS,
  STATE_ON_COLORS,
  STATE_SHORT_LABELS,
} from "@/features/marks/colors";
import type { CountryState } from "@/features/marks/colors";
import { useMarkToggle } from "@/features/marks/use-marks";
import { cn } from "@/shared/cn";

const STATE_ICON_CLASSES: Record<CountryState, string> = {
  visited: "state-icon-visited",
  want: "state-icon-want",
  not_interested: "state-icon-not_interested",
};

export function StateSwitch({ code, countryName }: { code: string; countryName: string }) {
  const { shown, toggle } = useMarkToggle(code);

  return (
    <div
      role="group"
      aria-label={`Mark ${countryName}`}
      className="flex shrink-0 gap-0.5 rounded-full bg-canvas-soft p-1"
    >
      {COUNTRY_STATES.map((countryState) => {
        const isActive = shown === countryState;

        return (
          <button
            key={countryState}
            type="button"
            aria-pressed={isActive}
            aria-label={STATE_LABELS[countryState]}
            title={STATE_LABELS[countryState]}
            onClick={() => toggle(countryState)}
            style={
              isActive
                ? {
                    backgroundColor: STATE_COLORS[countryState],
                    color: STATE_ON_COLORS[countryState],
                  }
                : undefined
            }
            className="state-option"
          >
            <span
              aria-hidden
              className={cn("size-[15px] sm:hidden", STATE_ICON_CLASSES[countryState])}
            />
            <span aria-hidden className="hidden sm:inline">
              {STATE_SHORT_LABELS[countryState]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
