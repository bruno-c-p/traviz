import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ContinentCard } from "@/components/continent-card";
import countryLabels from "@/data/country-labels.json";
import { CONTINENT_ORDER, countries, countryCenter, searchCountries } from "@/lib/countries";
import { computeStats, type Continent } from "@/lib/stats";

const countriesWithoutLabelToday = ["PSE"];
const countedCountriesWithoutCenterToday = ["PSE"];

const searchableEntriesWithoutCenterToday = [
  "ALA",
  "ASM",
  "AIA",
  "ABW",
  "BMU",
  "BVT",
  "IOT",
  "VGB",
  "BES",
  "CYM",
  "CXR",
  "CCK",
  "COK",
  "CUW",
  "FLK",
  "FRO",
  "GUF",
  "PYF",
  "ATF",
  "GIB",
  "GLP",
  "GUM",
  "GGY",
  "HMD",
  "HKG",
  "IMN",
  "JEY",
  "UNK",
  "MAC",
  "MTQ",
  "MYT",
  "MSR",
  "NCL",
  "NIU",
  "NFK",
  "MNP",
  "PSE",
  "PCN",
  "PRI",
  "REU",
  "BLM",
  "SHN",
  "MAF",
  "SPM",
  "SXM",
  "SGS",
  "SJM",
  "TWN",
  "TKL",
  "TCA",
  "UMI",
  "VIR",
  "WLF",
];

const continentsOverflowingToday: Continent[] = [
  "Africa",
  "Asia",
  "Europe",
  "North America",
  "South America",
  "Oceania",
];

const labelNames = new Set(countryLabels.map((label) => label.name));
const counted = countries.filter((country) => country.counted);
const searchable = countries.filter((country) => searchCountries(country.name).includes(country));

describe("country dataset invariants", () => {
  test("only the known counted countries lack a label", () => {
    const missingLabel = counted.flatMap((country) =>
      labelNames.has(country.name) ? [] : [country.code],
    );

    expect(missingLabel).toEqual(countriesWithoutLabelToday);
  });

  test("only the known counted countries lack a fly-to center", () => {
    const cannotFly = counted.flatMap((country) =>
      countryCenter(country.code) === null ? [country.code] : [],
    );

    expect(cannotFly).toEqual(countedCountriesWithoutCenterToday);
  });

  test("only the known searchable entries lack a fly-to center", () => {
    const cannotFly = searchable.flatMap((country) =>
      countryCenter(country.code) === null ? [country.code] : [],
    );

    expect(cannotFly).toEqual(searchableEntriesWithoutCenterToday);
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
