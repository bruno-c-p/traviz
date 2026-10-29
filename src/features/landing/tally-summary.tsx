"use client";

import { WALL_COUNTRIES } from "@/features/landing/landing-marks";
import { useLandingStore } from "@/features/landing/landing-store";
import { COUNTRY_STATES, STATE_COLORS, STATE_LABELS, tallyMarks } from "@/features/marks";
import { PaintLabel } from "@/features/landing/paint-label";
import { LastPick } from "@/features/landing/last-pick";
import { cn } from "@/shared/cn";

type TallySummaryProps = { size: "large" | "compact" };

export function TallySummary({ size }: TallySummaryProps) {
  const marks = useLandingStore((store) => store.marks);
  const isSample = useLandingStore((store) => store.isSample);
  const clear = useLandingStore((store) => store.clear);
  const tally = tallyMarks(WALL_COUNTRIES, marks);
  const isLarge = size === "large";

  return (
    <div className={cn("flex flex-col", isLarge ? "gap-3" : "gap-1.5")}>
      <div className="flex items-end gap-3">
        <p aria-hidden="true" className="flex items-baseline gap-2 font-mono tabular-nums">
          <span
            className={cn(
              "font-medium tracking-[-0.04em] text-ink",
              isLarge
                ? "text-[clamp(2.75rem,1.5rem+2vw,3.75rem)] leading-none"
                : "text-[26px] leading-none",
            )}
          >
            {tally.visited}
          </span>
          <span className={cn("text-mute", isLarge ? "text-lg" : "text-sm")}>
            / {WALL_COUNTRIES.length} visited
          </span>
        </p>
        <div className="flex min-w-0 flex-1 justify-end">{!isLarge && <LastPick />}</div>
        {tally.unmarked < WALL_COUNTRIES.length && (
          <button
            type="button"
            onClick={clear}
            className="pressable relative isolate inline-flex h-9 shrink-0 items-center overflow-hidden rounded-full border border-line px-3.5 text-[13px] font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
          >
            <PaintLabel
              label={isSample ? "Clear sample" : "Clear all"}
              coverClassName="flex items-center justify-center bg-ink text-canvas"
            />
          </button>
        )}
      </div>
      <ul
        aria-hidden="true"
        className={cn(
          "flex flex-wrap gap-x-4 gap-y-1 text-body",
          isLarge ? "text-[13px]" : "text-xs",
        )}
      >
        {COUNTRY_STATES.map((state) => (
          <li key={state} className="flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-[3px]"
              style={{ backgroundColor: STATE_COLORS[state] }}
            />
            {STATE_LABELS[state]}
            <span className="font-mono text-ink tabular-nums">{tally[state]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
