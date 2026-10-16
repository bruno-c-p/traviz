import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ContinentCard, computeStats } from "@/features/stats";
import { CONTINENT_ORDER, countries, searchCountries } from "@/features/countries/countries";
import type { Continent } from "@/features/countries/countries";

const continentsOverflowingToday: Continent[] = [
  "Africa",
  "Asia",
  "Europe",
  "North America",
  "South America",
  "Oceania",
];

const sovereign = countries.filter((country) => country.kind === "sovereign");

describe("country dataset invariants", () => {
  test("195 entries are sovereign: the 193 UN members plus the observer states Vatican City, which world-countries already lists as a UN member, and Palestine, which the generator adds by code", () => {
    const sovereignCodes = new Set(sovereign.map((country) => country.code));

    expect(sovereign).toHaveLength(195);
    expect(sovereignCodes.has("VAT")).toBe(true);
    expect(sovereignCodes.has("PSE")).toBe(true);
  });

  test("every sovereign entry has a globe label, Palestine included", () => {
    const missingLabel = sovereign.flatMap((country) =>
      country.hasGlobeLabel ? [] : [country.code],
    );

    expect(missingLabel).toEqual([]);
  });

  test("every entry is found by searching its own name", () => {
    const unsearchable = countries.flatMap((country) =>
      searchCountries(country.name).includes(country) ? [] : [country.code],
    );

    expect(unsearchable).toEqual([]);
  });

  test("every center is a longitude and latitude on the globe", () => {
    const offGlobe = countries.flatMap(({ code, center: [longitude, latitude] }) =>
      Math.abs(longitude) <= 180 && Math.abs(latitude) <= 90 ? [] : [code],
    );

    expect(offGlobe).toEqual([]);
  });

  test("only the known continents overflow 100% when every country is on the wish list", () => {
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

      return filled > 100.0001 ? [continent] : [];
    });

    expect(overflowing).toEqual(continentsOverflowingToday);
  });
});
