"use client";

import { AccountSection } from "@/features/auth";
import { ContinentCard } from "@/features/stats/continent-card";
import { DangerZone, STATE_COLORS, useCountriesStore } from "@/features/marks";
import { ProgressCard } from "@/features/stats/progress-card";
import { TotalTile } from "@/features/stats/total-tile";
import { CONTINENT_ORDER, countries } from "@/features/countries";
import { computeStats } from "@/features/stats/stats";

export function StatsPanel() {
  const marks = useCountriesStore((state) => state.marks);
  const stats = computeStats(marks, countries);

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 pt-6 md:px-6 md:pt-2">
      <h1 className="text-3xl font-bold tracking-tight text-ink md:text-4xl">Your travels</h1>

      <div className="flex flex-wrap gap-4">
        <ProgressCard variant="hero" className="min-w-0 flex-[2_1_420px] justify-center" />
        <div className="grid min-w-0 flex-[1_1_260px] grid-cols-2 gap-3 md:grid-cols-1">
          <TotalTile label="Want to go" value={stats.totals.want} color={STATE_COLORS.want} />
          <TotalTile
            label="Not interested"
            value={stats.totals.not_interested}
            color={STATE_COLORS.not_interested}
          />
          <TotalTile
            label="Visited, incl. territories"
            value={stats.totals.visited}
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
          {CONTINENT_ORDER.map((continent) => (
            <ContinentCard
              key={continent}
              continent={continent}
              stats={stats.byContinent[continent]}
            />
          ))}
        </div>
      </section>

      <div className="flex flex-wrap gap-4">
        <AccountSection className="min-w-0 flex-[1_1_360px]" />
        <DangerZone className="min-w-0 flex-[1_1_360px]" />
      </div>
    </div>
  );
}
