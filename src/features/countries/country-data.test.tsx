import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CONTINENT_POOLS, ContinentCard } from "@/features/stats";
import type { Marks } from "@/features/marks";
import { SOVEREIGN_COUNTRIES, countries, searchCountries } from "@/features/countries/countries";
import type { Country } from "@/features/countries/countries";

const sovereign = SOVEREIGN_COUNTRIES;

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

  test.each([
    ["Africa", "0 / 54", false],
    ["Asia", "0 / 47", false],
    ["Europe", "0 / 45", false],
    ["North America", "0 / 23", false],
    ["South America", "0 / 12", false],
    ["Oceania", "0 / 14", false],
    ["Antarctica", "0 / 5", true],
  ] as const)(
    "the %s card counts %s, territories only: %p",
    (continent, fraction, isTerritoriesOnly) => {
      const pool = CONTINENT_POOLS.find((candidate) => candidate.continent === continent);

      expect(pool?.isTerritoriesOnly).toBe(isTerritoriesOnly);

      const markup = pool ? renderToStaticMarkup(<ContinentCard pool={pool} marks={{}} />) : "";

      expect(markup).toContain(fraction);
    },
  );

  test.each([
    ["every entry is on the wish list", () => "want" as const],
    ["every entry is visited", () => "visited" as const],
    ["every entry is skipped", () => "not_interested" as const],
    [
      "sovereign entries are visited and territories are on the wish list",
      (country: Country) => (country.kind === "sovereign" ? "visited" : "want"),
    ],
  ] as const)("every continent bar fills exactly 100%% when %s", (_scenario, stateFor) => {
    const marks: Marks = Object.fromEntries(
      countries.map((country) => [country.code, stateFor(country)]),
    );

    const misfilled = CONTINENT_POOLS.flatMap((pool) => {
      const markup = renderToStaticMarkup(<ContinentCard pool={pool} marks={marks} />);

      const filled = [...markup.matchAll(/width:\s*([\d.]+)%/g)].reduce(
        (sum, match) => sum + Number(match[1]),
        0,
      );

      return Math.abs(filled - 100) > 0.0001 ? [`${pool.continent} ${filled.toFixed(1)}%`] : [];
    });

    expect(misfilled).toEqual([]);
  });
});
