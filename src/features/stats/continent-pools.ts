import { CONTINENT_ORDER, countriesInContinent } from "@/features/countries";
import type { Continent, Country } from "@/features/countries";

export type ContinentPool = {
  continent: Continent;
  countries: readonly Country[];
};

export const CONTINENT_POOLS: readonly ContinentPool[] = CONTINENT_ORDER.map((continent) => ({
  continent,
  countries: countriesInContinent(continent),
}));
