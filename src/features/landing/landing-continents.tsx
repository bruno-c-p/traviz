import { CONTINENT_ORDER, countriesInContinent } from "@/features/countries";
import { ContinentRow } from "@/features/landing/continent-row";
import { StateChip } from "@/features/landing/state-chip";

const CONTINENTS = CONTINENT_ORDER.flatMap((continent) => {
  const sovereign = countriesInContinent(continent).filter(
    (country) => country.kind === "sovereign",
  );

  return sovereign.length > 0 ? [{ continent, countries: sovereign }] : [];
});

export function LandingContinents() {
  return (
    <section aria-labelledby="continents-title" className="pt-14 pb-20 lg:py-36">
      <div className="mb-12 grid gap-5 md:grid-cols-12 md:gap-x-(--gutter)">
        <h2
          id="continents-title"
          className="text-[clamp(2.25rem,1.2rem+3vw,4.5rem)] leading-[0.95] font-bold tracking-[-0.045em] text-balance md:col-span-7 lg:col-span-6"
        >
          Where the count stands
        </h2>
        <p className="max-w-[46ch] self-end text-[17px] leading-[1.7] text-body md:col-span-5 lg:col-start-8">
          One square for each country, painted <StateChip state="visited" />,{" "}
          <StateChip state="want" /> or <StateChip state="not_interested" /> as you pick names
          above. Territories such as Greenland are on the globe and in the list, but outside the
          195.
        </p>
      </div>
      <ul>
        {CONTINENTS.map(({ continent, countries }) => (
          <ContinentRow key={continent} continent={continent} countries={countries} />
        ))}
      </ul>
    </section>
  );
}
