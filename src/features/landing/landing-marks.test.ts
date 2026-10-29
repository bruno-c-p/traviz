import { describe, expect, test } from "bun:test";
import {
  SAMPLE_MARKS,
  WALL_COUNTRIES,
  nextState,
  pickMark,
} from "@/features/landing/landing-marks";
import { COUNTRIES_BY_CODE } from "@/features/countries";

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

  test("the sample marks only sovereign countries", () => {
    for (const code of Object.keys(SAMPLE_MARKS)) {
      expect(COUNTRIES_BY_CODE.get(code)?.kind).toBe("sovereign");
    }
  });
});
