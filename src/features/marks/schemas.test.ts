import { describe, expect, test } from "bun:test";
import { countryCodeSchema, countryStateSchema, markChangeSchema } from "@/features/marks/schemas";
import { COUNTRY_STATES } from "@/features/marks/colors";
import type { MarkChange } from "@/features/marks/marks-sync";

describe("mark schemas", () => {
  test("countryCodeSchema accepts a known country code", () => {
    expect(countryCodeSchema.safeParse("BRA").success).toBe(true);
  });

  test("countryCodeSchema rejects an unknown country code", () => {
    expect(countryCodeSchema.safeParse("XXX").success).toBe(false);
  });

  test.each([...COUNTRY_STATES])("countryStateSchema accepts %s", (state) => {
    expect(countryStateSchema.safeParse(state).success).toBe(true);
  });

  test("countryStateSchema rejects an unknown state", () => {
    expect(countryStateSchema.safeParse("visiting").success).toBe(false);
  });

  const validChanges: readonly (readonly [string, MarkChange])[] = [
    ["a set", { kind: "set", code: "FRA", state: "want" }],
    ["a clear", { kind: "clear", code: "FRA" }],
    ["a reset", { kind: "reset" }],
  ];

  test.each(validChanges)("markChangeSchema accepts %s", (_name, change) => {
    expect(markChangeSchema.parse(change)).toEqual(change);
  });

  test.each([
    ["an unknown country code", { kind: "set", code: "XXX", state: "want" }],
    ["an unknown state", { kind: "set", code: "FRA", state: "visiting" }],
    ["a clear with no code", { kind: "clear" }],
    ["an unknown kind", { kind: "wipe" }],
    ["a value that is not a change", "reset"],
  ])("markChangeSchema rejects %s", (_name, change) => {
    expect(markChangeSchema.safeParse(change).success).toBe(false);
  });
});
