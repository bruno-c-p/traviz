import { expect, test } from "bun:test";
import { judge, mannWhitneyP, summarize, type Unit } from "@/shared/testing/perf/stats";

function compare(baseline: number[], candidate: number[], unit: Unit): string {
  return judge(baseline, candidate, unit).verdict;
}

test("summarize takes the median and the median absolute deviation", () => {
  expect(summarize([900, 1000, 1100, 1000, 3000])).toEqual({ median: 1000, mad: 100, runs: 5 });
  expect(summarize([1, 2, 3, 4])).toEqual({ median: 2.5, mad: 1, runs: 4 });
});

test("the exact Mann-Whitney p matches the tables", () => {
  expect(mannWhitneyP([1, 2, 3, 4, 5], [6, 7, 8, 9, 10])).toBeCloseTo(2 / 252, 6);
  expect(mannWhitneyP([1, 2, 3], [4, 5, 6])).toBeCloseTo(0.1, 6);
  expect(mannWhitneyP([1, 3, 5, 7, 9], [2, 4, 6, 8, 10])).toBeCloseTo(0.690476, 5);
});

test("samples that tie at the boundary do not count as separated", () => {
  expect(mannWhitneyP([1, 2, 3, 4, 5], [5, 6, 7, 8, 9])).toBeGreaterThan(0.01);
});

test("overlapping samples are within noise, even with a large median gap", () => {
  expect(compare([382, 480, 389, 395, 515], [447, 474, 466, 459, 426], "ms")).toBe("within noise");
});

test("fully separated samples are slower or faster", () => {
  expect(compare([1000, 1010, 990, 1005, 995], [1100, 1110, 1090, 1105, 1095], "ms")).toBe(
    "slower",
  );
  expect(compare([1000, 1010, 990, 1005, 995], [900, 910, 890, 905, 895], "ms")).toBe("faster");
  expect(compare([1000, 1010, 990], [1100, 1110, 1090], "ms")).toBe("within noise");
});

test("a separated timing shift under 50 ms or 5% is within noise", () => {
  expect(compare([1000, 1001, 1002, 1003, 1004], [1040, 1041, 1042, 1043, 1044], "ms")).toBe(
    "within noise",
  );
  expect(compare([2000, 2001, 2002, 2003, 2004], [2090, 2091, 2092, 2093, 2094], "ms")).toBe(
    "within noise",
  );
  expect(compare([2000, 2001, 2002, 2003, 2004], [2110, 2111, 2112, 2113, 2114], "ms")).toBe(
    "slower",
  );
});

test("byte deltas under 1 KB or 1% are within noise", () => {
  expect(compare([800_000], [807_000], "bytes")).toBe("within noise");
  expect(compare([800_000], [809_000], "bytes")).toBe("larger");
  expect(compare([50_000], [49_000], "bytes")).toBe("within noise");
  expect(compare([50_000], [48_900], "bytes")).toBe("smaller");
});
