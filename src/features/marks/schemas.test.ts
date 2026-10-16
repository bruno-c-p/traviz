import { describe, expect, test } from "bun:test";
import { countryCodeSchema, countryStateSchema } from "@/features/marks/schemas";
import { COUNTRY_STATES } from "@/features/marks/colors";

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
});
