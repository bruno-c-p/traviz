import { CONTINENT_ORDER, countries } from "@/features/countries";
import { computeStats } from "@/lib/stats";
import type { Continent } from "@/features/countries";
import { useCountriesStore } from "@/store/countries";

export type ContinentOption = {
  continent: Continent | null;
  label: string;
  visited: number;
  total: number;
};

export function useContinentOptions(): ContinentOption[] {
  const marks = useCountriesStore((state) => state.marks);
  const stats = computeStats(marks, countries);

  return [
    {
      continent: null,
      label: "All countries",
      visited: stats.totals.visited,
      total: countries.length,
    },
    ...CONTINENT_ORDER.map((continent) => ({
      continent,
      label: continent,
      visited: stats.byContinent[continent].visited,
      total: stats.byContinent[continent].total,
    })),
  ];
}
