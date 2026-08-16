import { Ban, Check, Star, X } from "lucide-react";
import type { ComponentType } from "react";
import { COUNTRY_STATES, STATE_COLORS, STATE_TEXT_COLORS } from "../lib/colors";
import type { CountryState } from "../lib/colors";
import { useCountriesStore } from "../store/countries";

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
  const iconSize = compact ? 14 : 16;
  const buttonSizeClass = compact ? "h-7 w-7" : "h-9 gap-1.5 px-3 text-xs";

  return (
    <div role="group" aria-label="Mark country state" className="flex items-center gap-1.5">
      {COUNTRY_STATES.map((state) => {
        const Icon = STATE_ICONS[state];
        const active = currentState === state;
        const color = STATE_COLORS[state];
        const textColor = STATE_TEXT_COLORS[state];

        return (
          <button
            key={state}
            type="button"
            aria-pressed={active}
            aria-label={STATE_LABELS[state]}
            title={STATE_LABELS[state]}
            onClick={() => toggle(code, state)}
            style={active ? { backgroundColor: `${color}26`, borderColor: color, color: textColor } : undefined}
            className={[
              "inline-flex items-center justify-center rounded-full border font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600",
              buttonSizeClass,
              active
                ? "border-transparent"
                : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900",
            ].join(" ")}
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
          className={[
            "inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600",
            compact ? "h-7 w-7" : "h-9 w-9",
          ].join(" ")}
        >
          <X size={iconSize} />
        </button>
      )}
    </div>
  );
}
