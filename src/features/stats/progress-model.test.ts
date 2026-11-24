import { describe, expect, test } from "bun:test";
import { countries } from "@/features/countries";
import { progressModel, progressTotalText } from "@/features/stats/progress-model";
import { visitedProgress } from "@/features/stats/visited-progress";

const POOL = [{ code: "FRA" }, { code: "JPN" }, { code: "BRA" }, { code: "KEN" }];

describe("progress card numbers", () => {
  test("counts visited against the places left once not interested ones are taken out", () => {
    const model = progressModel(POOL, { FRA: "visited", JPN: "want", BRA: "not_interested" });

    expect(model).toMatchObject({
      visited: 1,
      want: 1,
      total: 3,
      excluded: 1,
      percentText: "33.3%",
      reachableWidth: 75,
      summary: "1 of 3 places visited. See all stats",
    });
    expect(model.visitedOffset).toBeCloseTo(-66.667, 2);
  });

  test("no marks leaves a full-width track with an empty bar", () => {
    expect(progressModel(POOL, {})).toMatchObject({
      visited: 0,
      total: 4,
      excluded: 0,
      percentText: "0.0%",
      reachableWidth: 100,
      visitedOffset: -100,
    });
  });

  test("every place marked not interested divides by nothing", () => {
    const model = progressModel([{ code: "FRA" }], { FRA: "not_interested" });

    expect(model).toMatchObject({ total: 0, percentText: "0.0%", reachableWidth: 0 });
  });

  test("an empty pool keeps the track full", () => {
    expect(progressModel([], {}).reachableWidth).toBe(100);
  });

  test("a mark for a code outside the pool is not counted", () => {
    expect(progressModel(POOL, { XXX: "visited" }).visited).toBe(0);
  });

  test("agrees with the dataset-wide progress the stats page is checked against", () => {
    const marks = { FRA: "visited", JPN: "visited", BRA: "want", ATA: "not_interested" } as const;
    const model = progressModel(countries, marks);
    const expected = visitedProgress(marks);

    expect([model.visited, model.want, model.total, model.excluded]).toEqual([
      expected.visited,
      expected.want,
      expected.total,
      expected.excluded,
    ]);
    expect(model.percentText).toBe(`${expected.percent.toFixed(1)}%`);
  });

  test("the panel and the peek word the total differently", () => {
    const model = progressModel(POOL, { FRA: "visited" });

    expect(progressTotalText(model, "panel")).toBe("of 4 · 25.0%");
    expect(progressTotalText(model, "peek")).toBe("/ 4 visited");
  });
});
