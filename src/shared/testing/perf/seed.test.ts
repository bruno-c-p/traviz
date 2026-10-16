import { expect, test } from "bun:test";
import { seededMarks } from "@/shared/testing/perf/seed";

const codes = ["AFG", "AGO", "ALB", "AND", "ARE"];

test("assigns each planned state to the next codes, the same way every time", () => {
  const marks = seededMarks(codes, [
    ["visited", 2],
    ["want", 1],
  ]);

  expect(marks).toEqual([
    ["AFG", "visited"],
    ["AGO", "visited"],
    ["ALB", "want"],
  ]);
  expect(
    seededMarks(codes, [
      ["visited", 2],
      ["want", 1],
    ]),
  ).toEqual(marks);
});

test("refuses a plan with more marks than countries", () => {
  expect(() => seededMarks(codes, [["visited", 6]])).toThrow(
    "The seed plan needs 6 countries, but only 5 exist.",
  );
});
