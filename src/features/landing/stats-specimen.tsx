"use client";

import { WALL_COUNTRIES } from "@/features/landing/landing-marks";
import { useLandingStore } from "@/features/landing/landing-store";
import { COUNTRY_STATES, STATE_COLORS, tallyMarks, tallyShare } from "@/features/marks";

export function StatsSpecimen() {
  const marks = useLandingStore((store) => store.marks);
  const tally = tallyMarks(WALL_COUNTRIES, marks);

  return (
    <div className="flex flex-col gap-3">
      <p className="font-mono text-[15px] text-body tabular-nums">
        <span className="text-[32px] leading-none font-medium tracking-[-0.04em] text-ink">
          {tally.visited}
        </span>{" "}
        / {WALL_COUNTRIES.length} visited
      </p>
      <div aria-hidden="true" className="flex h-3 overflow-hidden rounded-full bg-line">
        {COUNTRY_STATES.map((state) => (
          <span
            key={state}
            className="h-full"
            style={{ width: `${tallyShare(tally, state)}%`, backgroundColor: STATE_COLORS[state] }}
          />
        ))}
      </div>
    </div>
  );
}
