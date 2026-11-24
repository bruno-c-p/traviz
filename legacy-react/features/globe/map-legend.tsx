import { COUNTRY_STATES, STATE_COLORS, STATE_LABELS } from "@/features/marks";
import { cn } from "@/shared/cn";

export function MapLegend({ className }: { className?: string }) {
  return (
    <ul aria-label="Legend" className={cn("flex-wrap gap-2", className)}>
      {COUNTRY_STATES.map((countryState) => (
        <li
          key={countryState}
          className="flex min-h-9 items-center gap-2 rounded-full bg-canvas px-3.5 text-[13px] font-medium text-ink shadow-float"
        >
          <span
            aria-hidden
            className="size-2.5 rounded-full"
            style={{ backgroundColor: STATE_COLORS[countryState] }}
          />
          {STATE_LABELS[countryState]}
        </li>
      ))}
    </ul>
  );
}
