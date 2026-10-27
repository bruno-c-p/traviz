"use client";

import { ContinentCard } from "@/features/stats/continent-card";
import { STATE_COLORS, tallyMarks, useMarks } from "@/features/marks";
import { ProgressCard } from "@/features/stats/progress-card";
import { TotalTile } from "@/features/stats/total-tile";
import { countries } from "@/features/countries";
import { CONTINENT_POOLS } from "@/features/stats/continent-pools";

export function StatsSummary() {
  const marks = useMarks();
  const allEntries = tallyMarks(countries, marks);

  return (
    <>
      <div className="flex flex-wrap gap-4">
        <ProgressCard variant="hero" className="min-w-0 flex-[2_1_420px] justify-center" />
        <div className="grid min-w-0 flex-[1_1_260px] grid-cols-2 gap-3 md:grid-cols-1">
          <TotalTile label="Want to go" value={allEntries.want} color={STATE_COLORS.want} />
          <TotalTile
            label="Not interested"
            value={allEntries.not_interested}
            color={STATE_COLORS.not_interested}
          />
          <TotalTile
            label="Visited, incl. territories"
            value={allEntries.visited}
            color={STATE_COLORS.visited}
            className="col-span-2 md:col-span-1"
          />
        </div>
      </div>

      <section aria-labelledby="continents-heading" className="flex flex-col gap-3">
        <h2
          id="continents-heading"
          className="font-mono text-xs uppercase tracking-wider text-mute"
        >
          By continent
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CONTINENT_POOLS.map((pool) => (
            <ContinentCard key={pool.continent} pool={pool} marks={marks} />
          ))}
        </div>
      </section>
    </>
  );
}
