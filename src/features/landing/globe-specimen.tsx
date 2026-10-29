"use client";

import { useLandingStore } from "@/features/landing/landing-store";
import { COUNTRIES_BY_CODE } from "@/features/countries";
import { STATE_COLORS, STATE_LABELS } from "@/features/marks";

const ISLANDS = ["MDV", "NRU", "PLW", "TON", "TUV"];

export function GlobeSpecimen() {
  const marks = useLandingStore((store) => store.marks);
  const pick = useLandingStore((store) => store.pick);

  return (
    <ul className="flex flex-wrap gap-x-2 gap-y-2">
      {ISLANDS.map((code) => {
        const state = marks[code];

        return (
          <li key={code}>
            <button
              type="button"
              onClick={() => pick(code)}
              className="group flex h-10 items-center gap-2.5 rounded-full px-3 text-[15px] text-ink transition-colors duration-200 ease-out hover:bg-land focus-visible:bg-land focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
            >
              <span
                aria-hidden="true"
                className="size-4 rounded-full shadow-[0_0_0_3px_#fff,0_1px_4px_3px_rgb(14_15_12/0.18)] transition-[background-color,scale] duration-300 ease-out group-hover:scale-125 group-focus-visible:scale-125 motion-reduce:transition-none"
                style={{ backgroundColor: STATE_COLORS[state ?? "unmarked"] }}
              />
              {COUNTRIES_BY_CODE.get(code)?.name}
              {state && <span className="sr-only">, {STATE_LABELS[state]}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
