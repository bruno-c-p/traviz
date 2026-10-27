import { describe, expect, test } from "bun:test";
import {
  continentLabelOpacity,
  continentLabelSize,
  countryLabelSize,
  placeLabels,
  wrapWords,
} from "@/features/globe/globe-labels";

function boxAt(left: number, top: number, width = 40, height = 10) {
  return { left, top, right: left + width, bottom: top + height };
}

describe("label sizes", () => {
  test("country labels grow with the country's area and the zoom, as the Mapbox style did", () => {
    expect(countryLabelSize(2_000_000, 1)).toBeCloseTo(11, 6);
    expect(countryLabelSize(500_000, 1)).toBeCloseTo(9, 6);
    expect(countryLabelSize(10_000, 1)).toBeCloseTo(8, 6);
    expect(countryLabelSize(2_000_000, 9)).toBeCloseTo(22, 6);
    expect(countryLabelSize(10_000, 3)).toBeGreaterThan(8);
    expect(countryLabelSize(10_000, 3)).toBeLessThan(countryLabelSize(10_000, 5));
  });

  test("continent labels grow until zoom 2.5 and fade out by then", () => {
    expect(continentLabelSize(0)).toBe(10);
    expect(continentLabelSize(2.5)).toBeCloseTo(15, 6);
    expect(continentLabelOpacity(0)).toBe(0.8);
    expect(continentLabelOpacity(1.5)).toBe(0.5);
    expect(continentLabelOpacity(2.5)).toBe(0);
    expect(continentLabelOpacity(4)).toBe(0);
  });
});

describe("wrapWords", () => {
  const tenPixelsPerCharacter = (line: string) => line.length * 10;

  test("breaks a long name between words", () => {
    expect(wrapWords("Central African Republic", tenPixelsPerCharacter, 100)).toEqual([
      "Central",
      "African",
      "Republic",
    ]);
  });

  test("keeps a short name and a single long word on one line", () => {
    expect(wrapWords("Bosnia and Herzegovina", tenPixelsPerCharacter, 120)).toEqual([
      "Bosnia and",
      "Herzegovina",
    ]);
    expect(wrapWords("Chad", tenPixelsPerCharacter, 100)).toEqual(["Chad"]);
  });
});

describe("placeLabels", () => {
  test("keeps the first of two overlapping labels and every label that fits", () => {
    const placed = placeLabels([
      { name: "Russia", box: boxAt(0, 0) },
      { name: "Estonia", box: boxAt(20, 5) },
      { name: "Japan", box: boxAt(200, 0) },
    ]);

    expect(placed.map((label) => label.name)).toEqual(["Russia", "Japan"]);
  });

  test("lets labels that only touch sit side by side", () => {
    expect(placeLabels([{ box: boxAt(0, 0) }, { box: boxAt(40, 0) }])).toHaveLength(2);
  });
});
