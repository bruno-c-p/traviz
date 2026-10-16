import { describe, expect, test } from "bun:test";
import { tallyMarks, tallyTotal } from "@/features/marks/tally";

describe("tallyMarks", () => {
  test("counts each pool entry once, by its mark or as unmarked, and ignores marks outside the pool", () => {
    const tally = tallyMarks([{ code: "FRA" }, { code: "PRT" }, { code: "JPN" }], {
      FRA: "visited",
      JPN: "want",
      BRA: "visited",
    });

    expect(tally).toEqual({ visited: 1, want: 1, not_interested: 0, unmarked: 1 });
    expect(tallyTotal(tally)).toBe(3);
  });

  test("counts an entry whose stored state is unknown, such as one left in stale localStorage, as unmarked", () => {
    const tally = tallyMarks([{ code: "FRA" }, { code: "PRT" }], { FRA: "been", PRT: "visited" });

    expect(tally).toEqual({ visited: 1, want: 0, not_interested: 0, unmarked: 1 });
    expect(tallyTotal(tally)).toBe(2);
  });

  test("an empty pool totals zero", () => {
    expect(tallyTotal(tallyMarks([], { FRA: "visited" }))).toBe(0);
  });
});
