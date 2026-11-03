import { describe, expect, test } from "bun:test";
import { SOVEREIGN_COUNTRIES, countries } from "@/features/countries";
import type { Marks } from "@/features/marks";
import { visitedProgress } from "@/features/stats/visited-progress";

describe("visitedProgress", () => {
  test("39 visited sovereign entries read as 20.0% of 195", () => {
    const marks: Marks = Object.fromEntries(
      SOVEREIGN_COUNTRIES.slice(0, 39).map((country) => [country.code, "visited"]),
    );

    const progress = visitedProgress(marks);

    expect(progress).toEqual({ visited: 39, total: 195, excluded: 0, percent: 20 });
    expect(progress.percent.toFixed(1)).toBe("20.0");
  });

  test("not interested sovereign entries leave the total", () => {
    const marks: Marks = {
      ...Object.fromEntries(
        SOVEREIGN_COUNTRIES.slice(0, 19).map((country) => [country.code, "not_interested"]),
      ),
      ...Object.fromEntries(
        SOVEREIGN_COUNTRIES.slice(19, 54).map((country) => [country.code, "visited"]),
      ),
    };

    expect(visitedProgress(marks)).toEqual({
      visited: 35,
      total: 176,
      excluded: 19,
      percent: (35 / 176) * 100,
    });
  });

  test("every entry not interested reads as 0% of 0", () => {
    const marks: Marks = Object.fromEntries(
      SOVEREIGN_COUNTRIES.map((country) => [country.code, "not_interested"]),
    );

    expect(visitedProgress(marks)).toEqual({ visited: 0, total: 0, excluded: 195, percent: 0 });
  });

  test("territories leave the sovereign headline unchanged", () => {
    const marks: Marks = Object.fromEntries(
      countries
        .filter((country) => country.kind === "territory")
        .map((country, index) => [country.code, index % 2 === 0 ? "visited" : "not_interested"]),
    );

    expect(visitedProgress(marks)).toEqual({ visited: 0, total: 195, excluded: 0, percent: 0 });
  });
});
