import { COUNTRY_STATES, STATE_COLORS, tallyMarks, tallyShare, tallyTotal } from "@/features/marks";
import type { Marks } from "@/features/marks";
import type { ContinentPool } from "@/features/stats/continent-pools";

type ContinentCardProps = {
  pool: ContinentPool;
  marks: Marks;
};

export function ContinentCard({ pool, marks }: ContinentCardProps) {
  const tally = tallyMarks(pool.countries, marks);
  const denominator = tallyTotal(tally);

  return (
    <article className="flex flex-col gap-3.5 rounded-3xl bg-canvas p-5 shadow-card">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-lg font-semibold text-ink">{pool.continent}</h3>
        <span className="font-mono text-[13px] tabular-nums text-mute">
          {tally.visited} / {denominator}
        </span>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-land">
        {COUNTRY_STATES.map((countryState) => (
          <div
            key={countryState}
            style={{
              width: `${tallyShare(tally, countryState)}%`,
              backgroundColor: STATE_COLORS[countryState],
            }}
          />
        ))}
      </div>
      <p className="text-[13px] text-body">
        {pool.isTerritoriesOnly
          ? "Territories only, not part of the 195 headline."
          : `${tally.want} on the wish list · ${tally.unmarked} unmarked`}
      </p>
    </article>
  );
}
