import { COUNTRY_STATES, STATE_COLORS, tallyTotal } from "@/features/marks";
import type { Tally } from "@/features/marks";
import type { Continent } from "@/features/countries";

type ContinentCardProps = {
  continent: Continent;
  tally: Tally;
  isTerritoriesOnly: boolean;
};

export function ContinentCard({ continent, tally, isTerritoriesOnly }: ContinentCardProps) {
  const denominator = tallyTotal(tally);

  return (
    <article className="flex flex-col gap-3.5 rounded-3xl bg-canvas p-5 shadow-card">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-lg font-semibold text-ink">{continent}</h3>
        <span className="font-mono text-[13px] tabular-nums text-mute">
          {tally.visited} / {denominator}
        </span>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-land">
        {COUNTRY_STATES.map((countryState) => (
          <div
            key={countryState}
            style={{
              width: `${denominator > 0 ? (tally[countryState] / denominator) * 100 : 0}%`,
              backgroundColor: STATE_COLORS[countryState],
            }}
          />
        ))}
      </div>
      <p className="text-[13px] text-body">
        {isTerritoriesOnly
          ? "Territories only, not part of the 195 headline."
          : `${tally.want} on the wish list · ${tally.unmarked} unmarked`}
      </p>
    </article>
  );
}
