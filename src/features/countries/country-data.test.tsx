import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CONTINENT_POOLS, ContinentCard } from "@/features/stats";
import { tallyMarks } from "@/features/marks";
import type { Marks } from "@/features/marks";
import { countries, searchCountries } from "@/features/countries/countries";
import type { Country } from "@/features/countries/countries";

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

  test("the continent cards that count toward the headline add up to the 195 sovereign entries", () => {
    const headlinePools = CONTINENT_POOLS.filter((pool) => !pool.isTerritoriesOnly);

    expect(headlinePools.reduce((sum, pool) => sum + pool.countries.length, 0)).toBe(195);
  });

  test.each([
    ["every entry is on the wish list", () => "want" as const],
    ["every entry is visited", () => "visited" as const],
    ["every entry is skipped", () => "not_interested" as const],
    [
      "sovereign entries are visited and territories are on the wish list",
      (country: Country) => (country.kind === "sovereign" ? "visited" : "want"),
    ],
  ] as const)("no continent bar fills past 100%% when %s", (_scenario, stateFor) => {
    const marks: Marks = Object.fromEntries(
      countries.map((country) => [country.code, stateFor(country)]),
    );

    const overflowing = CONTINENT_POOLS.flatMap((pool) => {
      const markup = renderToStaticMarkup(
        <ContinentCard
          continent={pool.continent}
          tally={tallyMarks(pool.countries, marks)}
          isTerritoriesOnly={pool.isTerritoriesOnly}
        />,
      );

      const filled = [...markup.matchAll(/width:\s*([\d.]+)%/g)].reduce(
        (sum, match) => sum + Number(match[1]),
        0,
      );

      return filled > 100.0001 ? [`${pool.continent} ${filled.toFixed(1)}%`] : [];
    });

    expect(overflowing).toEqual([]);
  });
});
