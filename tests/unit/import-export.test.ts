import { describe, expect, it } from "vitest";
import { exportMarks, importMarks } from "../../src/lib/importExport";
import type { Marks } from "../../src/lib/colors";

const VALID_CODES = ["FRA", "JPN", "DEU", "BRA"];

describe("exportMarks", () => {
  it("serializes marks with the version envelope", () => {
    const marks: Marks = { FRA: "visited", JPN: "want" };
    const json = exportMarks(marks);
    expect(JSON.parse(json)).toEqual({ version: 1, countries: { FRA: "visited", JPN: "want" } });
  });

  it("round-trips through importMarks", () => {
    const marks: Marks = { FRA: "visited", JPN: "want", DEU: "not_interested" };
    const result = importMarks(exportMarks(marks), VALID_CODES);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.marks).toEqual(marks);
      expect(result.skipped).toEqual([]);
    }
  });
});

describe("importMarks", () => {
  it("rejects unparseable JSON without throwing", () => {
    expect(() => importMarks("{not json", VALID_CODES)).not.toThrow();
    const result = importMarks("{not json", VALID_CODES);
    expect(result.ok).toBe(false);
  });

  it("rejects a fully garbage, non-JSON file as an error result, not an exception", () => {
    expect(() => importMarks("this is just text, not json at all", VALID_CODES)).not.toThrow();
    const result = importMarks("this is just text, not json at all", VALID_CODES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(typeof result.error).toBe("string");
      expect(result.error.length).toBeGreaterThan(0);
    }
  });

  it("rejects a JSON array as the root value", () => {
    const result = importMarks(JSON.stringify([1, 2, 3]), VALID_CODES);
    expect(result.ok).toBe(false);
  });

  it("rejects a JSON primitive as the root value", () => {
    const result = importMarks(JSON.stringify("hello"), VALID_CODES);
    expect(result.ok).toBe(false);
  });

  it("rejects a missing version", () => {
    const result = importMarks(JSON.stringify({ countries: { FRA: "visited" } }), VALID_CODES);
    expect(result.ok).toBe(false);
  });

  it("rejects a wrong version", () => {
    const result = importMarks(
      JSON.stringify({ version: 2, countries: { FRA: "visited" } }),
      VALID_CODES,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a non-object countries field", () => {
    const result = importMarks(JSON.stringify({ version: 1, countries: "nope" }), VALID_CODES);
    expect(result.ok).toBe(false);
  });

  it("rejects an array countries field", () => {
    const result = importMarks(
      JSON.stringify({ version: 1, countries: ["visited"] }),
      VALID_CODES,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a missing countries field", () => {
    const result = importMarks(JSON.stringify({ version: 1 }), VALID_CODES);
    expect(result.ok).toBe(false);
  });

  it("imports an empty countries object", () => {
    const result = importMarks(JSON.stringify({ version: 1, countries: {} }), VALID_CODES);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.marks).toEqual({});
      expect(result.skipped).toEqual([]);
    }
  });

  it("skips unknown ISO codes but keeps valid rows", () => {
    const result = importMarks(
      JSON.stringify({ version: 1, countries: { FRA: "visited", XXX: "visited" } }),
      VALID_CODES,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.marks).toEqual({ FRA: "visited" });
      expect(result.skipped).toEqual([{ code: "XXX", value: "visited", reason: "unknown_code" }]);
    }
  });

  it("skips invalid state strings but keeps valid rows", () => {
    const result = importMarks(
      JSON.stringify({ version: 1, countries: { FRA: "visited", JPN: "maybe" } }),
      VALID_CODES,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.marks).toEqual({ FRA: "visited" });
      expect(result.skipped).toEqual([{ code: "JPN", value: "maybe", reason: "invalid_state" }]);
    }
  });

  it("skips non-string values but keeps valid rows", () => {
    const result = importMarks(
      JSON.stringify({
        version: 1,
        countries: { FRA: "visited", JPN: 42, DEU: null, BRA: { nested: true } },
      }),
      VALID_CODES,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.marks).toEqual({ FRA: "visited" });
      expect(result.skipped).toEqual(
        expect.arrayContaining([
          { code: "JPN", value: 42, reason: "invalid_value" },
          { code: "DEU", value: null, reason: "invalid_value" },
          { code: "BRA", value: { nested: true }, reason: "invalid_value" },
        ]),
      );
      expect(result.skipped).toHaveLength(3);
    }
  });

  it("imports a file mixing good rows and every kind of bad row at once", () => {
    const result = importMarks(
      JSON.stringify({
        version: 1,
        countries: {
          FRA: "visited",
          JPN: "want",
          XXX: "visited",
          DEU: "not_a_state",
          BRA: 123,
        },
      }),
      VALID_CODES,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.marks).toEqual({ FRA: "visited", JPN: "want" });
      expect(result.skipped).toHaveLength(3);
    }
  });
});
