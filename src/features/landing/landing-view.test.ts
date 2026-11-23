import { describe, expect, test } from "bun:test";
import {
  cellStates,
  changedCodes,
  clearLabel,
  listRows,
  stateSuffix,
  tallyAnnouncement,
} from "@/features/landing/landing-view";

const POOL = [
  { code: "AFG", name: "Afghanistan", continent: "Asia", flag: "🇦🇫" },
  { code: "ALB", name: "Albania", continent: "Europe", flag: "🇦🇱" },
  { code: "DZA", name: "Algeria", continent: "Africa", flag: "🇩🇿" },
  { code: "AND", name: "Andorra", continent: "Europe", flag: "🇦🇩" },
  { code: "AGO", name: "Angola", continent: "Africa", flag: "🇦🇴" },
];

const codesOf = (rows: readonly { code: string }[]) => rows.map((row) => row.code);

describe("cellStates", () => {
  test("orders one cell per country as visited, want, not interested, then unmarked", () => {
    expect(cellStates({ visited: 2, want: 1, not_interested: 1, unmarked: 2 })).toEqual([
      "visited",
      "visited",
      "want",
      "not_interested",
      "unmarked",
      "unmarked",
    ]);
  });
});

describe("listRows", () => {
  test("shows the first three marked countries in wall order", () => {
    const marks = { AGO: "visited", ALB: "want", AND: "visited", DZA: "not_interested" } as const;

    expect(codesOf(listRows(POOL, marks))).toEqual(["ALB", "DZA", "AND"]);
  });

  test("shows fewer rows when fewer countries are marked", () => {
    expect(codesOf(listRows(POOL, { AND: "want" }))).toEqual(["AND"]);
  });

  test("falls back to the first three countries when nothing is marked", () => {
    expect(codesOf(listRows(POOL, {}))).toEqual(["AFG", "ALB", "DZA"]);
  });
});

describe("changedCodes", () => {
  test("names the countries that were set, changed or cleared", () => {
    expect(
      changedCodes(
        { FRA: "visited", JPN: "want", PER: "visited" },
        { FRA: "visited", JPN: "not_interested", KEN: "want" },
      ).toSorted(),
    ).toEqual(["JPN", "KEN", "PER"]);
  });

  test("is empty when the marks are the same", () => {
    expect(changedCodes({ FRA: "visited" }, { FRA: "visited" })).toEqual([]);
  });
});

describe("labels", () => {
  test("a marked name ends with its state and an unmarked name with nothing", () => {
    expect(stateSuffix("want")).toBe(", Want to go");
    expect(stateSuffix(undefined)).toBe("");
  });

  test("the clear button names the sample until the first pick", () => {
    expect(clearLabel(true)).toBe("Clear sample");
    expect(clearLabel(false)).toBe("Clear all");
  });

  test("the announcement reads the three counts against the total", () => {
    expect(tallyAnnouncement({ visited: 12, want: 5, not_interested: 1, unmarked: 177 }, 195)).toBe(
      "12 of 195 visited, 5 want to go, 1 not interested.",
    );
  });
});
