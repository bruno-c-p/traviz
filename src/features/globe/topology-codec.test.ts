import { describe, expect, test } from "bun:test";
import { COUNTRY_TOPOLOGY } from "@/features/globe/country-topology.generated";
import { packTopology, unpackTopology } from "@/features/globe/topology-codec";

const SQUARE_AND_NEIGHBOUR = {
  scale: [0.5, 0.25] as const,
  translate: [-10, 20] as const,
  arcs: [
    [
      [0, 0],
      [0, 4],
      [4, 0],
    ],
    [
      [4, 4],
      [0, -4],
      [-4, 0],
    ],
    [
      [4, 4],
      [3000, 0],
      [0, -4],
      [-3000, 0],
      [0, 4],
    ],
  ],
  countries: [
    { code: "AAA", polygons: [[[0, 1]]] },
    { code: undefined, polygons: [[[2]], [[-2, -1]]] },
  ],
};

describe("topology codec", () => {
  test("unpacks the rings a topology's arcs describe", () => {
    expect(unpackTopology(packTopology(SQUARE_AND_NEIGHBOUR))).toEqual([
      {
        code: "AAA",
        polygons: [
          [
            [
              [-10, 20],
              [-10, 21],
              [-8, 21],
              [-8, 20],
              [-10, 20],
            ],
          ],
        ],
      },
      {
        code: null,
        polygons: [
          [
            [
              [-8, 21],
              [1492, 21],
              [1492, 20],
              [-8, 20],
              [-8, 21],
            ],
          ],
          [
            [
              [-10, 20],
              [-8, 20],
              [-8, 21],
              [-10, 21],
              [-10, 20],
            ],
          ],
        ],
      },
    ]);
  });

  test("packs into text a script can hold without escapes", () => {
    const { codes, rings, arcs } = packTopology(SQUARE_AND_NEIGHBOUR);

    expect(codes).toBe("AAA,");
    expect(`${rings}${arcs}`).toMatch(/^[ !#%-[\]^_a-~]+$/);
  });

  test("closes a ring that has fewer than four points", () => {
    const [country] = unpackTopology(
      packTopology({
        scale: [1, 1],
        translate: [0, 0],
        arcs: [
          [
            [1, 1],
            [1, 0],
          ],
        ],
        countries: [{ code: "AAA", polygons: [[[0]]] }],
      }),
    );

    expect(country?.polygons).toEqual([
      [
        [
          [1, 1],
          [2, 1],
          [1, 1],
          [1, 1],
        ],
      ],
    ]);
  });

  test("the generated outlines are closed rings inside the world", () => {
    const rings = unpackTopology(COUNTRY_TOPOLOGY).flatMap(({ polygons }) => polygons.flat());

    expect(rings.length).toBeGreaterThan(1000);

    for (const ring of rings) {
      expect(ring.length).toBeGreaterThanOrEqual(4);
      expect(ring.at(-1)).toEqual(ring[0]);

      for (const [longitude, latitude] of ring) {
        expect(Math.abs(longitude)).toBeLessThanOrEqual(180);
        expect(Math.abs(latitude)).toBeLessThanOrEqual(90);
      }
    }
  });
});
