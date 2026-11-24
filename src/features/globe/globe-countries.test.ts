import { describe, expect, test } from "bun:test";
import {
  countries,
  countryRowOf,
  decodeCountryRows,
  encodeCountryRows,
  searchCountries,
} from "@/features/countries";
import {
  MAX_SEARCH_RESULTS,
  countryMeta,
  searchGlobeCountries,
} from "@/features/globe/globe-countries";

const decoded = decodeCountryRows(encodeCountryRows(countries.map(countryRowOf)));

describe("countries sent to the globe view", () => {
  test("every entry survives the trip through the HTML with its name, continent and kind", () => {
    expect(
      decoded.map((country) => [
        country.code,
        country.name,
        country.continent,
        country.isTerritory,
      ]),
    ).toEqual(
      countries.map((country) => [
        country.code,
        country.name,
        country.continent,
        country.kind === "territory",
      ]),
    );
  });

  test("no name or continent holds the separators the encoding uses", () => {
    const unsafe = countries.flatMap((country) =>
      /[\t\n<]/.test(`${country.name}${country.continent}`) ? [country.code] : [],
    );

    expect(unsafe).toEqual([]);
  });

  test("an empty text decodes to no countries", () => {
    expect(decodeCountryRows("")).toEqual([]);
  });
});

describe("globe search", () => {
  test("finds the same first six entries, in the same order, as the dataset search", () => {
    for (const query of ["united", "a", "gui", "côte", "saint", "  Japan ", "zzzz", ""]) {
      expect(searchGlobeCountries(decoded, query).map((country) => country.code)).toEqual(
        searchCountries(query)
          .slice(0, MAX_SEARCH_RESULTS)
          .map((country) => country.code),
      );
    }
  });

  test("lists names that start with the query before names that only contain it", () => {
    expect(searchGlobeCountries(decoded, "nia").map((country) => country.name)).toEqual([
      "Albania",
      "Armenia",
      "Bosnia and Herzegovina",
      "Estonia",
      "Lithuania",
      "Mauritania",
    ]);
    expect(searchGlobeCountries(decoded, "nig").map((country) => country.name)).toEqual([
      "Niger",
      "Nigeria",
    ]);
  });

  test("ignores accents and case", () => {
    expect(searchGlobeCountries(decoded, "CURACAO").map((country) => country.code)).toEqual([
      "CUW",
    ]);
  });
});

describe("country heading line", () => {
  test("names the continent and the code, and says when the entry is a territory", () => {
    const byCode = new Map(decoded.map((country) => [country.code, country]));
    const japan = byCode.get("JPN");
    const greenland = byCode.get("GRL");

    expect(japan && countryMeta(japan)).toBe("Asia · JPN");
    expect(greenland && countryMeta(greenland)).toBe("North America · GRL · Territory");
  });
});
