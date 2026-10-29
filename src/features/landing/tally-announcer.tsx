"use client";

import { WALL_COUNTRIES } from "@/features/landing/landing-marks";
import { useLandingStore } from "@/features/landing/landing-store";
import { tallyMarks } from "@/features/marks";

export function TallyAnnouncer() {
  const marks = useLandingStore((store) => store.marks);
  const tally = tallyMarks(WALL_COUNTRIES, marks);

  return (
    <p className="sr-only" aria-live="polite">
      {`${tally.visited} of ${WALL_COUNTRIES.length} visited, ${tally.want} want to go, ${tally.not_interested} not interested.`}
    </p>
  );
}
