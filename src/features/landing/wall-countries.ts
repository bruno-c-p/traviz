import { CONTINENT_ORDER, SOVEREIGN_COUNTRIES } from "@/features/countries/core";

export const WALL_COUNTRIES = SOVEREIGN_COUNTRIES.toSorted((first, second) =>
  first.name.localeCompare(second.name, "en"),
);

export const WALL_CONTINENTS = CONTINENT_ORDER.flatMap((continent) => {
  const countries = WALL_COUNTRIES.filter((country) => country.continent === continent);

  return countries.length > 0 ? [{ continent, countries }] : [];
});

export const ISLAND_CODES = ["MDV", "NRU", "PLW", "TON", "TUV"];
