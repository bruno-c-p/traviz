import { describe, expect, test } from "bun:test";
import { SOVEREIGN_COUNTRIES, countries, searchCountries } from "@/features/countries/countries";

describe("country dataset invariants", () => {
  test("195 entries are sovereign: the 193 UN members plus the observer states Vatican City, which world-countries already lists as a UN member, and Palestine, which the generator adds by code", () => {
    const sovereignCodes = new Set(SOVEREIGN_COUNTRIES.map((country) => country.code));

    expect(SOVEREIGN_COUNTRIES).toHaveLength(195);
    expect(sovereignCodes.has("VAT")).toBe(true);
    expect(sovereignCodes.has("PSE")).toBe(true);
  });

  test("every sovereign entry has a globe label, Palestine included", () => {
    const missingLabel = SOVEREIGN_COUNTRIES.flatMap((country) =>
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
});
