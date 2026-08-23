"use client";

import countriesData from "@/data/countries.json";
import type { Continent, ContinentStats, Country, StateCounts } from "@/lib/stats";
import { computeStats } from "@/lib/stats";
import { COUNTRY_STATES, STATE_COLORS, STATE_TEXT_COLORS } from "@/lib/colors";
import { useCountriesStore } from "@/store/countries";

const countries = countriesData as Country[];

const CONTINENT_ORDER: readonly Continent[] = [
  "Africa",
  "Asia",
  "Europe",
  "North America",
  "South America",
  "Oceania",
  "Antarctica",
];

const STATE_LABELS = {
  visited: "Visited",
  want: "Want",
  not_interested: "Not interested",
} as const;

export function StatsPanel() {
  const marks = useCountriesStore((s) => s.marks);
  const stats = computeStats(marks, countries);
  const headlinePct =
    stats.headline.total > 0 ? (stats.headline.visited / stats.headline.total) * 100 : 0;

  return (
    <>
      <h1 className="px-6 pt-6 text-lg font-semibold text-ink">Stats</h1>

      <div className="flex flex-col gap-8 px-6 py-6">
        <section className="text-center">
          <div
            className="text-5xl font-bold tabular-nums"
            style={{ color: STATE_TEXT_COLORS.visited }}
          >
            {stats.headline.visited}
            <span className="text-2xl text-mute"> / {stats.headline.total}</span>
          </div>
          <p className="mt-1 text-sm text-body">countries visited</p>
          <div className="mx-auto mt-4 h-2 max-w-xs overflow-hidden rounded-full bg-canvas-soft">
            <div
              className="h-full rounded-full"
              style={{ width: `${headlinePct}%`, backgroundColor: STATE_COLORS.visited }}
            />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-body">
            Totals (incl. territories)
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {COUNTRY_STATES.map((key) => (
              <div key={key} className="rounded-lg bg-canvas-soft px-3 py-3 text-center">
                <div className="text-2xl font-semibold tabular-nums text-ink">
                  {stats.totals[key]}
                </div>
                <div className="mt-1 flex items-center justify-center gap-1.5 text-xs text-body">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: STATE_COLORS[key] }}
                  />
                  {STATE_LABELS[key]}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-body">
            By continent
          </h2>
          <div className="flex flex-col gap-4">
            {CONTINENT_ORDER.map((continent) => (
              <ContinentRow
                key={continent}
                continent={continent}
                stats={stats.byContinent[continent]}
              />
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function ContinentRow({ continent, stats }: { continent: Continent; stats: ContinentStats }) {
  const { countedTotal, countedVisited } = stats;

  // Antarctica has no counted (headline-eligible) countries, only
  // territories — a progress bar against a 0 denominator is meaningless, so
  // show its territory marks as a plain summary instead.
  if (countedTotal === 0) {
    return <TerritoriesOnlyRow continent={continent} stats={stats} />;
  }

  const pct = (n: number) => (n / countedTotal) * 100;

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span className="text-ink">{continent}</span>
        <span className="text-xs tabular-nums text-mute">
          {countedVisited} / {countedTotal} visited
        </span>
      </div>
      <div
        className="flex h-2 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: STATE_COLORS.unmarked }}
      >
        <div style={{ width: `${pct(countedVisited)}%`, backgroundColor: STATE_COLORS.visited }} />
        <div style={{ width: `${pct(stats.want)}%`, backgroundColor: STATE_COLORS.want }} />
        <div
          style={{
            width: `${pct(stats.not_interested)}%`,
            backgroundColor: STATE_COLORS.not_interested,
          }}
        />
      </div>
    </div>
  );
}

function TerritoriesOnlyRow({ continent, stats }: { continent: Continent; stats: ContinentStats }) {
  const marked = stats.visited + stats.want + stats.not_interested;
  const chips: { key: keyof StateCounts; count: number }[] = [
    { key: "visited", count: stats.visited },
    { key: "want", count: stats.want },
    { key: "not_interested", count: stats.not_interested },
  ];

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span className="text-ink">{continent}</span>
        <span className="text-xs tabular-nums text-mute">{stats.total} territories</span>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-mute bg-canvas-soft px-3 py-2 text-xs text-body">
        <span>Territories only — not part of the 195 headline.</span>
        {marked > 0 && (
          <span className="ml-auto flex shrink-0 items-center gap-2 tabular-nums">
            {chips
              .filter((chip) => chip.count > 0)
              .map((chip) => (
                <span key={chip.key} className="flex items-center gap-1">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: STATE_COLORS[chip.key] }}
                  />
                  {chip.count}
                </span>
              ))}
          </span>
        )}
      </div>
    </div>
  );
}
