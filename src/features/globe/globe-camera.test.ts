import { describe, expect, test } from "bun:test";
import {
  clampCamera,
  easeInOutCubic,
  easeOutCubic,
  globeScale,
  panCamera,
} from "@/features/globe/globe-camera";

describe("globe camera", () => {
  test("uses Mapbox's globe scale, matched at 45 degrees of latitude", () => {
    expect(globeScale(0)).toBeCloseTo(512 / (2 * Math.PI) / Math.SQRT1_2, 6);
    expect(globeScale(3) / globeScale(2)).toBeCloseTo(2, 6);
  });

  test("wraps longitude and keeps latitude short of the poles", () => {
    expect(clampCamera({ center: [190, 95], zoom: 2 })).toEqual({ center: [-170, 85], zoom: 2 });
    expect(clampCamera({ center: [-540, -100], zoom: 2 }).center).toEqual([-180, -85]);
  });

  test("keeps the zoom between 1 and 5", () => {
    expect(clampCamera({ center: [0, 0], zoom: 0.2 }).zoom).toBe(1);
    expect(clampCamera({ center: [0, 0], zoom: 9 }).zoom).toBe(5);
  });

  test("a drag moves the ground with the pointer", () => {
    const pixelsPerDegree = (globeScale(2) * Math.PI) / 180;

    const right = panCamera({ center: [10, 0], zoom: 2 }, pixelsPerDegree, 0);
    const down = panCamera({ center: [10, 0], zoom: 2 }, 0, pixelsPerDegree);

    expect(right.center[0]).toBeCloseTo(9, 6);
    expect(down.center[1]).toBeCloseTo(1, 6);
  });

  test("eases start at rest and finish on the target", () => {
    for (const ease of [easeInOutCubic, easeOutCubic]) {
      expect(ease(0)).toBe(0);
      expect(ease(1)).toBe(1);
    }

    expect(easeInOutCubic(0.5)).toBe(0.5);
  });
});
