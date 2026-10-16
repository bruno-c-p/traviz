import { CONTINENT_ORDER, countries } from "@/features/countries";
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
      const continentCountries = countries.filter((country) => country.continent === continent);

      return {
        continent,
        label: continent,
        visited: tallyMarks(continentCountries, marks).visited,
        total: continentCountries.length,
      };
    }),
  ];
}
