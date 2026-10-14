"use client";

import { Ban, Check, Star, X } from "lucide-react";
import type { ComponentType } from "react";
import { COUNTRY_STATES, STATE_COLORS, STATE_ON_COLORS } from "@/lib/colors";
import type { CountryState } from "@/lib/colors";
import { useCountriesStore } from "@/store/countries";
import { cn } from "@/lib/utils";

const STATE_LABELS: Record<CountryState, string> = {
  visited: "Visited",
  want: "Want to go",
  not_interested: "Not interested",
};

const STATE_ICONS: Record<CountryState, ComponentType<{ size?: number }>> = {
  visited: Check,
  want: Star,
  not_interested: Ban,
};

export function StateButtons({ code, size = "md" }: { code: string; size?: "sm" | "md" }) {
  const currentState = useCountriesStore((s) => s.marks[code]);
  const toggle = useCountriesStore((s) => s.toggle);
  const clear = useCountriesStore((s) => s.clear);

  const compact = size === "sm";
  const iconSize = compact ? 15 : 16;
  const buttonSizeClass = compact ? "h-9 w-9" : "h-11 gap-2 px-4 text-sm";

  return (
    <div
      role="group"
      aria-label="Mark country state"
      className={cn("flex flex-wrap items-center", compact ? "gap-1" : "gap-2")}
    >
      {COUNTRY_STATES.map((state) => {
        const Icon = STATE_ICONS[state];
        const active = currentState === state;
        const color = STATE_COLORS[state];
        const textColor = STATE_ON_COLORS[state];

        return (
          <button
            key={state}
            type="button"
            aria-pressed={active}
            aria-label={STATE_LABELS[state]}
            title={STATE_LABELS[state]}
            onClick={() => toggle(code, state)}
            style={active ? { backgroundColor: color, color: textColor } : undefined}
            className={cn(
              "inline-flex items-center justify-center rounded-full font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2",
              buttonSizeClass,
              !active && "bg-canvas-soft text-body hover:bg-land hover:text-ink",
            )}
          >
            <Icon size={iconSize} />
            {!compact && <span>{STATE_LABELS[state]}</span>}
          </button>
        );
      })}

      {currentState && (
        <button
          type="button"
          aria-label="Clear mark"
          title="Clear"
          onClick={() => clear(code)}
          className={cn(
            "inline-flex items-center justify-center rounded-full text-mute transition-colors hover:bg-canvas-soft hover:text-ink",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2",
            compact ? "h-9 w-9" : "h-11 w-11",
          )}
        >
          <X size={iconSize} />
        </button>
      )}
    </div>
  );
}
