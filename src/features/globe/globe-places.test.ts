import { describe, expect, test } from "bun:test";
import { countries, countryCenter } from "@/features/countries";
import { GLOBE_PLACES, placeCenter } from "@/features/globe/globe-places";

describe("globe places", () => {
  test("the globe has every dataset country, in dataset order, at its dataset centre", () => {
    expect(GLOBE_PLACES.map(({ code, center }) => ({ code, center }))).toEqual(
      countries.map(({ code, center: [longitude, latitude] }) => ({
        code,
        center: [longitude, latitude],
      })),
    );
  });

  test("a country has a label, with its name and area, exactly when the dataset gives it one", () => {
    expect(GLOBE_PLACES.map(({ label }) => label)).toEqual(
      countries.map(({ name, area, hasGlobeLabel }) => (hasGlobeLabel ? { name, area } : null)),
    );
  });

  test("placeCenter gives the dataset centre of a code and null for an unknown one", () => {
    expect(placeCenter("JPN")).toEqual(countryCenter("JPN"));
    expect(placeCenter("XXX")).toBeNull();
  });

  test("placeCenter hands out a copy, so a caller cannot move a country", () => {
    const center = placeCenter("JPN");

    if (center) center[0] += 10;

    expect(placeCenter("JPN")).toEqual(countryCenter("JPN"));
  });
});
