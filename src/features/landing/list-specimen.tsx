"use client";

import { WALL_COUNTRIES } from "@/features/landing/landing-marks";
import { useLandingStore } from "@/features/landing/landing-store";
import { StateChip } from "@/features/landing/state-chip";

const ROWS = 3;

export function ListSpecimen() {
  const marks = useLandingStore((store) => store.marks);
  const marked = WALL_COUNTRIES.filter((country) => marks[country.code]).slice(0, ROWS);
  const rows = marked.length > 0 ? marked : WALL_COUNTRIES.slice(0, ROWS);

  return (
    <ul className="divide-y divide-line rounded-md border border-line bg-canvas">
      {rows.map((country) => {
        const state = marks[country.code];

        return (
          <li key={country.code} className="flex items-center gap-3 px-3.5 py-2.5 text-[15px]">
            <span aria-hidden="true">{country.flag}</span>
            <span className="min-w-0 flex-1 truncate text-ink">{country.name}</span>
            <span className="text-xs text-mute">{country.continent}</span>
            {state ? (
              <StateChip state={state} className="text-xs leading-6" />
            ) : (
              <span className="text-xs leading-6 text-mute">Not marked</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
