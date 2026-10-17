import { CONTINENT_ORDER, countries, countriesInContinent } from "@/features/countries";
import type { Continent } from "@/features/countries";
import { tallyMarks, useCountriesStore } from "@/features/marks";

export type ContinentOption = {
  continent: Continent | null;
  label: string;
  visited: number;
  total: number;
};

export function useContinentOptions(): ContinentOption[] {
  const marks = useCountriesStore((state) => state.marks);

  return [
    {
      continent: null,
      label: "All countries",
      visited: tallyMarks(countries, marks).visited,
      total: countries.length,
    },
    ...CONTINENT_ORDER.map((continent) => {
      const continentCountries = countriesInContinent(continent);

      return {
        continent,
        label: continent,
        visited: tallyMarks(continentCountries, marks).visited,
        total: continentCountries.length,
      };
    }),
  ];
}
