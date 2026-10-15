import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ContinentCard } from "@/components/continent-card";
import countryLabels from "@/data/country-labels.json";
import { CONTINENT_ORDER, countries, countryCenter, searchCountries } from "@/lib/countries";
import { computeStats } from "@/lib/stats";

const labelNames = new Set(countryLabels.map((label) => label.name));
const searchable = countries.filter((country) => searchCountries(country.name).includes(country));

describe("country dataset invariants", () => {
  test.failing("every counted country has a label and a fly-to center", () => {
    const counted = countries.filter((country) => country.counted);

    const missingLabel = counted
      .filter((country) => !labelNames.has(country.name))
      .map((country) => country.code);

    const cannotFly = counted
      .filter((country) => countryCenter(country.code) === null)
      .map((country) => country.code);

    expect(missingLabel).toEqual([]);
    expect(cannotFly).toEqual([]);
  });

  test.failing("every searchable entry has a fly-to center", () => {
    const cannotFly = searchable
      .filter((country) => countryCenter(country.code) === null)
      .map((country) => country.code);

    expect(cannotFly).toEqual([]);
  });

  test.failing("continent bars never exceed 100% when every country is on the wish list", () => {
    const allWanted = Object.fromEntries(
      countries.map((country) => [country.code, "want" as const]),
    );

    const stats = computeStats(allWanted, countries);

    const overflowing = CONTINENT_ORDER.flatMap((continent) => {
      const markup = renderToStaticMarkup(
        <ContinentCard continent={continent} stats={stats.byContinent[continent]} />,
      );

      const filled = [...markup.matchAll(/width:\s*([\d.]+)%/g)].reduce(
        (sum, match) => sum + Number(match[1]),
        0,
      );

      return filled > 100.0001 ? [`${continent}=${filled.toFixed(1)}%`] : [];
    });

    expect(overflowing).toEqual([]);
  });
});
