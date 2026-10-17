import { CONTINENT_ORDER, countriesInContinent } from "@/features/countries";
import type { Continent, Country } from "@/features/countries";

export type ContinentPool = {
  continent: Continent;
  countries: readonly Country[];
  isTerritoriesOnly: boolean;
};

export const CONTINENT_POOLS: readonly ContinentPool[] = CONTINENT_ORDER.map((continent) => {
  const inContinent = countriesInContinent(continent);
  const sovereignInContinent = inContinent.filter((country) => country.kind === "sovereign");

  return sovereignInContinent.length > 0
    ? { continent, countries: sovereignInContinent, isTerritoriesOnly: false }
    : { continent, countries: inContinent, isTerritoriesOnly: true };
});
