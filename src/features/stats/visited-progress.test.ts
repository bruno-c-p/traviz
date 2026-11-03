import { describe, expect, test } from "bun:test";
import { countries } from "@/features/countries";
import type { Marks } from "@/features/marks";
import { visitedProgress } from "@/features/stats/visited-progress";

const territories = countries.filter((country) => country.kind === "territory");

describe("visitedProgress", () => {
  test("50 visited places read as 20.0% of 250", () => {
    const marks: Marks = Object.fromEntries(
      countries.slice(0, 50).map((country) => [country.code, "visited"]),
    );

    const progress = visitedProgress(marks);

    expect(progress).toEqual({ visited: 50, want: 0, total: 250, excluded: 0, percent: 20 });
    expect(progress.percent.toFixed(1)).toBe("20.0");
  });

  test("visited and wanted territories count like countries", () => {
    const marks: Marks = Object.fromEntries(
      territories.map((country, index) => [country.code, index % 2 === 0 ? "visited" : "want"]),
    );

    const visited = Math.ceil(territories.length / 2);

    expect(visitedProgress(marks)).toEqual({
      visited,
      want: territories.length - visited,
      total: 250,
      excluded: 0,
      percent: (visited / 250) * 100,
    });
  });

  test("not interested places, territories included, leave the total", () => {
    const marks: Marks = {
      ...Object.fromEntries(
        countries.slice(0, 18).map((country) => [country.code, "not_interested"]),
      ),
      [territories.at(-1)?.code ?? ""]: "not_interested",
      [countries[20]?.code ?? ""]: "visited",
    };

    expect(visitedProgress(marks)).toEqual({
      visited: 1,
      want: 0,
      total: 231,
      excluded: 19,
      percent: (1 / 231) * 100,
    });
  });

  test("every place not interested reads as 0% of 0", () => {
    const marks: Marks = Object.fromEntries(
      countries.map((country) => [country.code, "not_interested"]),
    );

    expect(visitedProgress(marks)).toEqual({
      visited: 0,
      want: 0,
      total: 0,
      excluded: 250,
      percent: 0,
    });
  });
});
