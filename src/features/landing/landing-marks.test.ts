import { describe, expect, test } from "bun:test";
import { SAMPLE_MARKS, nextState, pickMark } from "@/features/landing/landing-marks";
import { ISLAND_CODES, WALL_CONTINENTS, WALL_COUNTRIES } from "@/features/landing/wall-countries";

describe("pickMark", () => {
  test("cycles a country through visited, want to go, not interested and back to unmarked", () => {
    const once = pickMark({}, "PER");
    const twice = pickMark(once, "PER");
    const thrice = pickMark(twice, "PER");

    expect(once).toEqual({ PER: "visited" });
    expect(twice).toEqual({ PER: "want" });
    expect(thrice).toEqual({ PER: "not_interested" });
    expect(pickMark(thrice, "PER")).toEqual({});
  });

  test("leaves the other marks as they are", () => {
    expect(pickMark({ FRA: "visited", JPN: "want" }, "JPN")).toEqual({
      FRA: "visited",
      JPN: "not_interested",
    });
  });

  test("an unmarked country's next state is visited", () => {
    expect(nextState(undefined)).toBe("visited");
  });
});

describe("the wall", () => {
  test("holds the 195 sovereign countries in alphabetical order", () => {
    const names = WALL_COUNTRIES.map((country) => country.name);

    expect(names).toHaveLength(195);
    expect(names).toEqual(names.toSorted((first, second) => first.localeCompare(second, "en")));
  });

  test("the sample marks and the island dots are all on the wall", () => {
    const codes = new Set(WALL_COUNTRIES.map((country): string => country.code));

    const offTheWall = [...Object.keys(SAMPLE_MARKS), ...ISLAND_CODES].filter(
      (code) => !codes.has(code),
    );

    expect(offTheWall).toEqual([]);
  });

  test("splits into the six continents that have countries", () => {
    expect(
      WALL_CONTINENTS.map(({ continent, countries }) => [continent, countries.length]),
    ).toEqual([
      ["Africa", 54],
      ["Asia", 47],
      ["Europe", 45],
      ["North America", 23],
      ["South America", 12],
      ["Oceania", 14],
    ]);
  });
});
