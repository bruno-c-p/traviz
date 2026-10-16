import { CONTINENT_ORDER, countries } from "@/features/countries";
import type { Continent, Country } from "@/features/countries";

type ContinentPool = {
  continent: Continent;
  countries: readonly Country[];
  isTerritoriesOnly: boolean;
};

export const sovereignCountries = countries.filter((country) => country.kind === "sovereign");

export const CONTINENT_POOLS: readonly ContinentPool[] = CONTINENT_ORDER.map((continent) => {
  const sovereignInContinent = sovereignCountries.filter(
    (country) => country.continent === continent,
  );

  return sovereignInContinent.length > 0
    ? { continent, countries: sovereignInContinent, isTerritoriesOnly: false }
    : {
        continent,
        countries: countries.filter((country) => country.continent === continent),
        isTerritoriesOnly: true,
      };
});
