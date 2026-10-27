import { describe, expect, test } from "bun:test";
import { countries, countryCenter } from "@/features/countries";
import type { LngLat } from "@/features/globe/globe-camera";
import { COUNTRY_TOPOLOGY } from "@/features/globe/country-topology.generated";
import { buildMarkers, markerAt, placeMarkers } from "@/features/globe/globe-markers";
import { buildScene, countryAt, globeView } from "@/features/globe/globe-scene";

const scene = buildScene(COUNTRY_TOPOLOGY);
const markers = buildMarkers(scene);

function centerOf(code: string): LngLat {
  const center = countryCenter(code);

  if (!center) throw new Error(`${code} is not in the dataset`);

  return center;
}

function placedCodes(center: LngLat, zoom: number) {
  return placeMarkers(markers, globeView({ center, zoom }, 1440, 900)).map(({ code }) => code);
}

describe("country markers", () => {
  test("only these dataset countries have no outline at all", () => {
    const outlined = new Set(scene.countries.map(({ code }) => code));

    expect(countries.filter(({ code }) => !outlined.has(code)).map(({ code }) => code)).toEqual([
      "BVT",
      "GIB",
      "TKL",
      "TUV",
      "UMI",
    ]);
  });

  test("a country with no outline or a too small one shows a marker at its centre at every zoom", () => {
    for (const code of ["TUV", "GIB", "TKL", "MCO", "SGP", "VAT"]) {
      for (const zoom of [1, 3, 5]) {
        const view = globeView({ center: centerOf(code), zoom }, 1440, 900);
        const marker = placeMarkers(markers, view).find((candidate) => candidate.code === code);

        expect(marker?.x).toBeCloseTo(720, 6);
        expect(marker?.y).toBeCloseTo(450, 6);
      }
    }
  });

  test("a small country shows a marker until zooming in makes its outline big enough", () => {
    const luxembourg = centerOf("LUX");

    expect(placedCodes(luxembourg, 1.4)).toContain("LUX");
    expect(placedCodes(luxembourg, 5)).not.toContain("LUX");
    expect(placedCodes(centerOf("FRA"), 1)).not.toContain("FRA");
    expect(placedCodes(centerOf("RUS"), 1)).not.toContain("RUS");
  });

  test("hides the markers on the far side of the globe", () => {
    expect(placedCodes([-170, 0], 1.4)).not.toContain("MCO");
    expect(placedCodes([-170, 0], 1.4)).toContain("TUV");
  });

  test("a tap within 12 px picks the nearest marker, before the outline under it", () => {
    const sanMarino = centerOf("SMR");
    const placed = placeMarkers(markers, globeView({ center: sanMarino, zoom: 4 }, 800, 600));

    expect(countryAt(scene, sanMarino)).toBe("ITA");
    expect(markerAt(placed, { x: 400, y: 310 })).toBe("SMR");
    expect(markerAt(placed, { x: 400, y: 313 })).toBeNull();
    expect(
      markerAt(
        [
          { code: "FAR", x: 10, y: 0 },
          { code: "NEAR", x: 4, y: 0 },
        ],
        { x: 0, y: 0 },
      ),
    ).toBe("NEAR");
  });
});
