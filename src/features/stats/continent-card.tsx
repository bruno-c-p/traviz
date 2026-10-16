import { COUNTRY_STATES, STATE_COLORS } from "@/features/marks";
import type { ContinentStats } from "@/features/stats/stats";
import type { Continent } from "@/features/countries";

type ContinentCardProps = {
  continent: Continent;
  stats: ContinentStats;
};

export function ContinentCard({ continent, stats }: ContinentCardProps) {
  const isTerritoriesOnly = stats.countedTotal === 0;
  const denominator = isTerritoriesOnly ? stats.total : stats.countedTotal;
  const visitedCount = isTerritoriesOnly ? stats.visited : stats.countedVisited;
  const unmarked = stats.total - stats.visited - stats.want - stats.not_interested;

  const segmentWidths = {
    visited: visitedCount,
    want: stats.want,
    not_interested: stats.not_interested,
  };

  return (
    <article className="flex flex-col gap-3.5 rounded-3xl bg-canvas p-5 shadow-card">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-lg font-semibold text-ink">{continent}</h3>
        <span className="font-mono text-[13px] tabular-nums text-mute">
          {visitedCount} / {denominator}
        </span>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-land">
        {COUNTRY_STATES.map((countryState) => (
          <div
            key={countryState}
            style={{
              width: `${denominator > 0 ? (segmentWidths[countryState] / denominator) * 100 : 0}%`,
              backgroundColor: STATE_COLORS[countryState],
            }}
          />
        ))}
      </div>
      <p className="text-[13px] text-body">
        {isTerritoriesOnly
          ? "Territories only, not part of the 195 headline."
          : `${stats.want} on the wish list · ${unmarked} unmarked`}
      </p>
    </article>
  );
}
