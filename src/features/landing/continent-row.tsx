"use client";

import type { Country } from "@/features/countries";
import { useLandingStore } from "@/features/landing/landing-store";
import { COUNTRY_STATES, tallyMarks } from "@/features/marks";
import type { StateColorKey } from "@/features/marks";
import { cn } from "@/shared/cn";

const CELL_FILLS: Record<StateColorKey, string> = {
  visited: "bg-primary",
  want: "bg-want",
  not_interested: "bg-skip",
  unmarked: "bg-line",
};

const CELL_ORDER: readonly StateColorKey[] = [...COUNTRY_STATES, "unmarked"];

type ContinentRowProps = { continent: string; countries: readonly Country[] };

export function ContinentRow({ continent, countries }: ContinentRowProps) {
  const marks = useLandingStore((store) => store.marks);
  const tally = tallyMarks(countries, marks);

  const cells = CELL_ORDER.flatMap((state) =>
    Array.from({ length: tally[state] }, () => CELL_FILLS[state]),
  );

  return (
    <li className="grid gap-x-(--gutter) gap-y-3 border-t border-line py-6 md:grid-cols-12 md:items-baseline">
      <h3 className="text-[clamp(1.5rem,1.1rem+1.4vw,2.5rem)] leading-none font-bold tracking-[-0.035em] md:col-span-4 lg:col-span-3">
        {continent}
      </h3>
      <p className="font-mono text-sm text-body tabular-nums md:col-span-3 lg:col-span-2">
        <span className="text-ink">{tally.visited}</span> of {countries.length} visited
      </p>
      <div aria-hidden="true" className="flex flex-wrap gap-1 md:col-span-5 lg:col-span-7">
        {cells.map((fill, index) => (
          <span
            key={index}
            className={cn(
              "size-3.5 rounded-[3px] transition-colors duration-300 ease-out motion-reduce:transition-none",
              fill,
            )}
          />
        ))}
      </div>
    </li>
  );
}
