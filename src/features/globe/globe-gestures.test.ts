import { describe, expect, test } from "bun:test";
import { createGestureTracker } from "@/features/globe/globe-gestures";
import type { Point } from "@/features/globe/globe-gestures";

function recordGestures() {
  const events: string[] = [];
  const pans: [number, number][] = [];
  const zooms: { point: Point; zoomDelta: number }[] = [];
  const releases: Point[] = [];

  const tracker = createGestureTracker({
    begin: () => events.push("begin"),
    pan: (dx, dy) => {
      events.push("pan");
      pans.push([dx, dy]);
    },
    zoomAround: (point, zoomDelta) => {
      events.push("zoom");
      zooms.push({ point, zoomDelta });
    },
    release: (velocity) => {
      events.push("release");
      releases.push(velocity);
    },
    tap: () => events.push("tap"),
    doubleTap: () => events.push("doubleTap"),
  });

  function tap(point: Point, time: number) {
    tracker.down(1, point, time);
    tracker.up(1, point, time + 50, false);
  }

  return { tracker, events, pans, zooms, releases, tap };
}

describe("globe gestures", () => {
  test("a press and release in place is a tap", () => {
    const gestures = recordGestures();

    gestures.tap({ x: 10, y: 10 }, 0);

    expect(gestures.events).toEqual(["begin", "tap"]);
  });

  test("a jitter under four pixels is still a tap and moves nothing", () => {
    const gestures = recordGestures();

    gestures.tracker.down(1, { x: 10, y: 10 }, 0);
    gestures.tracker.move(1, { x: 12, y: 11 }, 20);
    gestures.tracker.up(1, { x: 12, y: 11 }, 40, false);

    expect(gestures.events).toEqual(["begin", "tap"]);
  });

  test("two quick taps in one place zoom in, a slow second tap does not", () => {
    const quick = recordGestures();

    quick.tap({ x: 10, y: 10 }, 0);
    quick.tap({ x: 14, y: 12 }, 200);

    expect(quick.events.filter((event) => event !== "begin")).toEqual(["tap", "tap", "doubleTap"]);

    const slow = recordGestures();

    slow.tap({ x: 10, y: 10 }, 0);
    slow.tap({ x: 10, y: 10 }, 600);

    expect(slow.events).not.toContain("doubleTap");
  });

  test("a drag pans by the pointer movement and glides on release instead of tapping", () => {
    const gestures = recordGestures();

    gestures.tracker.down(1, { x: 0, y: 0 }, 0);
    gestures.tracker.move(1, { x: 10, y: 0 }, 10);
    gestures.tracker.move(1, { x: 30, y: 5 }, 20);

    expect(gestures.tracker.isDragging()).toBe(true);

    gestures.tracker.up(1, { x: 30, y: 5 }, 20, false);

    expect(gestures.pans).toEqual([
      [10, 0],
      [20, 5],
    ]);
    expect(gestures.events).not.toContain("tap");
    expect(gestures.releases).toEqual([{ x: 1500, y: 250 }]);
    expect(gestures.tracker.isDragging()).toBe(false);
  });

  test("a drag that pauses before release does not glide", () => {
    const gestures = recordGestures();

    gestures.tracker.down(1, { x: 0, y: 0 }, 0);
    gestures.tracker.move(1, { x: 40, y: 0 }, 10);
    gestures.tracker.up(1, { x: 40, y: 0 }, 500, false);

    expect(gestures.releases).toEqual([{ x: 0, y: 0 }]);
  });

  test("two fingers spreading apart zoom in around their midpoint", () => {
    const gestures = recordGestures();

    gestures.tracker.down(1, { x: 100, y: 100 }, 0);
    gestures.tracker.down(2, { x: 200, y: 100 }, 0);
    gestures.tracker.move(2, { x: 300, y: 100 }, 10);
    gestures.tracker.up(2, { x: 300, y: 100 }, 20, false);
    gestures.tracker.up(1, { x: 100, y: 100 }, 20, false);

    expect(gestures.zooms).toEqual([{ point: { x: 200, y: 100 }, zoomDelta: 1 }]);
    expect(gestures.events).not.toContain("tap");
    expect(gestures.events.at(-1)).toBe("release");
  });

  test("a cancelled press is never a tap", () => {
    const gestures = recordGestures();

    gestures.tracker.down(1, { x: 10, y: 10 }, 0);
    gestures.tracker.up(1, { x: 10, y: 10 }, 30, true);

    expect(gestures.events).toEqual(["begin", "release"]);
  });

  test("a wheel turn zooms around the pointer, at most half a level per event", () => {
    const gestures = recordGestures();

    gestures.tracker.wheel({ x: 5, y: 6 }, -225);
    gestures.tracker.wheel({ x: 5, y: 6 }, 2000);

    expect(gestures.zooms).toEqual([
      { point: { x: 5, y: 6 }, zoomDelta: 0.5 },
      { point: { x: 5, y: 6 }, zoomDelta: -0.5 },
    ]);
    expect(gestures.events.filter((event) => event === "begin")).toHaveLength(2);
  });

  test("hover moves are not tracked as gestures", () => {
    const gestures = recordGestures();

    expect(gestures.tracker.move(1, { x: 1, y: 1 }, 0)).toBe(false);
  });
});
