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

    expect(progress).toEqual({ visited: 39, total: 195, percent: 20 });
    expect(progress.percent.toFixed(1)).toBe("20.0");
  });

  test("visited territories leave the sovereign headline unchanged", () => {
    const marks: Marks = Object.fromEntries(
      countries
        .filter((country) => country.kind === "territory")
        .map((country) => [country.code, "visited"]),
    );

    expect(visitedProgress(marks)).toEqual({ visited: 0, total: 195, percent: 0 });
  });
});
