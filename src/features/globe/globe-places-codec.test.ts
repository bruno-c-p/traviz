import { describe, expect, test } from "bun:test";
import { packGlobePlaces, unpackGlobePlaces } from "@/features/globe/globe-places-codec";

const LABELED = {
  code: "AAA",
  name: "Saint Example, North and South",
  center: [-63.16666666, 18.25],
  area: 1234.5,
  hasGlobeLabel: true,
} as const;

const UNLABELED = {
  code: "BBB",
  name: "Example Island",
  center: [0, -90],
  area: 199,
  hasGlobeLabel: false,
} as const;

describe("globe places codec", () => {
  test("a labeled place keeps its code, centre, name and area", () => {
    expect(unpackGlobePlaces(packGlobePlaces([LABELED]))).toEqual([
      {
        code: "AAA",
        center: [-63.16666666, 18.25],
        label: { name: "Saint Example, North and South", area: 1234.5 },
      },
    ]);
  });

  test("a place with no globe label ships no name and no area", () => {
    const packed = packGlobePlaces([UNLABELED]);

    expect(packed).toBe("BBB|0|-90");
    expect(unpackGlobePlaces(packed)).toEqual([{ code: "BBB", center: [0, -90], label: null }]);
  });

  test("places unpack in the order they were packed", () => {
    const places = unpackGlobePlaces(packGlobePlaces([UNLABELED, LABELED, UNLABELED]));

    expect(places.map(({ code }) => code)).toEqual(["BBB", "AAA", "BBB"]);
  });

  test("packing refuses a name that holds a separator", () => {
    expect(() => packGlobePlaces([{ ...LABELED, name: "One|Two" }])).toThrow("AAA");
    expect(() => packGlobePlaces([{ ...LABELED, name: "One;Two" }])).toThrow("AAA");
  });

  test("a truncated place is dropped", () => {
    expect(unpackGlobePlaces("AAA|1|2;BBB|3;")).toEqual([
      { code: "AAA", center: [1, 2], label: null },
    ]);
  });
});
