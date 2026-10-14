"use client";

import {
  COUNTRY_STATES,
  STATE_COLORS,
  STATE_LABELS,
  STATE_ON_COLORS,
  STATE_SHORT_LABELS,
} from "@/lib/colors";
import { STATE_ICONS } from "@/lib/state-icons";
import { cn } from "@/lib/utils";
import { useCountriesStore } from "@/store/countries";

export function StateSwitch({ code, countryName }: { code: string; countryName: string }) {
  const currentState = useCountriesStore((state) => state.marks[code]);
  const toggle = useCountriesStore((state) => state.toggle);

  return (
    <div
      role="group"
      aria-label={`Mark ${countryName}`}
      className="flex shrink-0 gap-0.5 rounded-full bg-canvas-soft p-1"
    >
      {COUNTRY_STATES.map((countryState) => {
        const Icon = STATE_ICONS[countryState];
        const isActive = currentState === countryState;

        return (
          <button
            key={countryState}
            type="button"
            aria-pressed={isActive}
            aria-label={STATE_LABELS[countryState]}
            title={STATE_LABELS[countryState]}
            onClick={() => toggle(code, countryState)}
            style={
              isActive
                ? {
                    backgroundColor: STATE_COLORS[countryState],
                    color: STATE_ON_COLORS[countryState],
                  }
                : undefined
            }
            className={cn(
              "flex h-9 w-10 items-center justify-center rounded-full text-[13px] font-semibold transition-colors sm:w-auto sm:px-3.5",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink",
              !isActive && "text-body hover:bg-canvas hover:text-ink",
            )}
          >
            <Icon size={15} strokeWidth={2.2} aria-hidden className="sm:hidden" />
            <span aria-hidden className="hidden sm:inline">
              {STATE_SHORT_LABELS[countryState]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
