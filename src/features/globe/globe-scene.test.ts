import { describe, expect, test } from "bun:test";
import type { Feature } from "geojson";
import { countries } from "@/features/countries";
import type { LngLat } from "@/features/globe/globe-camera";
import { COUNTRY_TOPOLOGY } from "@/features/globe/country-topology.generated";
import { buildScene, countryAt, countryOutline, globeView } from "@/features/globe/globe-scene";

const scene = buildScene(COUNTRY_TOPOLOGY);

function polygonPoints({ geometry }: Feature): LngLat[] {
  const rings = geometry.type === "MultiPolygon" ? geometry.coordinates.flat() : [];

  return rings.flat().map(([longitude, latitude]) => [longitude, latitude]);
}

const DEFAULT_CAMERA = { center: [0, 20], zoom: 1.4 } satisfies { center: LngLat; zoom: number };

describe("the globe view", () => {
  test("shows the default camera as large as the Mapbox globe did on a 1440 x 900 screen", () => {
    expect(globeView(DEFAULT_CAMERA, 1440, 900).radius).toBeCloseTo(251, -1);
  });

  test("puts the camera centre in the middle of the canvas", () => {
    const { projection } = globeView({ center: [138, 36], zoom: 3 }, 800, 600);

    expect(projection([138, 36])).toEqual([400, 300]);
  });

  test("turns a projected point back into the same place", () => {
    const { projection } = globeView(DEFAULT_CAMERA, 1440, 900);

    for (const place of [
      [4.5, 50.6],
      [-40, -10],
      [60, 45],
    ] satisfies LngLat[]) {
      const point = projection(place);
      const back = point ? projection.invert?.(point) : null;

      expect(back?.[0]).toBeCloseTo(place[0], 6);
      expect(back?.[1]).toBeCloseTo(place[1], 6);
    }
  });

  test("traces a country in front of the horizon where the clipped projection puts it", () => {
    const camera = { center: [12, 38] satisfies LngLat, zoom: 2 };
    const view = globeView(camera, 390, 844);
    const belgium = scene.countries.find((country) => country.code === "BEL");
    const traced: [number, number][] = [];
    const record = (x: number, y: number) => traced.push([x, y]);

    if (!belgium) throw new Error("Belgium has no outline");

    view.traceFront(
      { moveTo: record, lineTo: record },
      belgium.parts.flatMap((part) => part.rings),
    );

    const expected = polygonPoints(belgium.feature).map((point) => view.projection(point));

    expect(traced).toHaveLength(expected.length);
    traced.forEach(([x, y], index) => {
      expect(x).toBeCloseTo(expected[index]?.[0] ?? Number.NaN, 6);
      expect(y).toBeCloseTo(expected[index]?.[1] ?? Number.NaN, 6);
    });
  });

  test("never reaches past the horizon", () => {
    expect(globeView(DEFAULT_CAMERA, 1440, 900).horizon).toBeLessThan(Math.PI / 2);
  });
});

describe("country hit test", () => {
  test.each([
    ["Brussels", [4.35, 50.85], "BEL"],
    ["Paris", [2.35, 48.86], "FRA"],
    ["Pristina", [21.17, 42.67], "UNK"],
    ["Hargeisa in Somaliland", [44.06, 9.56], "SOM"],
    ["North Nicosia", [33.36, 35.19], "CYP"],
    ["Cayenne", [-52.33, 4.93], "GUF"],
    ["Longyearbyen", [15.63, 78.22], "SJM"],
    ["Fiji across the antimeridian", [178.4, -18.1], "FJI"],
  ] satisfies [string, LngLat, string][])("%s is in %s", (_place, point, code) => {
    expect(countryAt(scene, point)).toBe(code);
  });

  test("open ocean belongs to no country", () => {
    expect(countryAt(scene, [-30, 30])).toBeNull();
  });
});

describe("country data", () => {
  test("every outline belongs to a dataset country except the disputed Siachen Glacier", () => {
    const codes = new Set<string>(countries.map((country) => country.code));
    const uncoded = scene.countries.filter((country) => country.code === null);

    expect(scene.countries.filter((country) => country.code && !codes.has(country.code))).toEqual(
      [],
    );
    expect(uncoded).toHaveLength(1);
  });

  test("only five tiny places have no outline to click", () => {
    const outlined = new Set(scene.countries.map((country) => country.code));

    expect(
      countries.filter((country) => !outlined.has(country.code)).map((country) => country.code),
    ).toEqual(["BVT", "GIB", "TKL", "TUV", "UMI"]);
  });

  test("outlines the selected country and nothing when no country is selected", () => {
    expect(countryOutline(scene, "BEL")?.coordinates.length).toBeGreaterThan(0);
    expect(countryOutline(scene, null)).toBeNull();
  });
});
