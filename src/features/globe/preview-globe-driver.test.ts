import { describe, expect, test } from "bun:test";
import type { Camera } from "@/features/globe/globe-camera";
import { startPreviewGlobe } from "@/features/globe/preview-globe-driver";

function createFakeMap() {
  let center = { lng: 0, lat: 20 };
  const flights: Camera[] = [];
  let removed = false;

  return {
    getCenter: () => ({ ...center }),
    getZoom: () => 1,
    jumpTo: (options: { center: [number, number] }) => {
      center = { lng: options.center[0], lat: options.center[1] };
    },
    flyTo: (camera: Camera) => {
      flights.push(camera);
    },
    onUserInteraction: () => {},
    remove: () => {
      removed = true;
    },
    longitude: () => center.lng,
    flights,
    isRemoved: () => removed,
  };
}

function createFakeClock() {
  const frames = new Map<number, (now: number) => void>();
  const timers = new Map<number, () => void>();
  let nextId = 1;
  let now = 0;

  return {
    frames: {
      requestAnimationFrame: (callback: (now: number) => void) => {
        const id = nextId++;

        frames.set(id, callback);

        return id;
      },
      cancelAnimationFrame: (id: number) => {
        frames.delete(id);
      },
    },
    timers: {
      setTimeout: (callback: () => void) => {
        const id = nextId++;

        timers.set(id, callback);

        return id;
      },
      clearTimeout: (id: number) => {
        timers.delete(id);
      },
    },
    runFrames: (count: number) => {
      for (let frame = 0; frame < count; frame++) {
        now += 16;
        const due = [...frames.values()];

        frames.clear();

        for (const callback of due) callback(now);
      }
    },
    runTimers: () => {
      const due = [...timers.values()];

      timers.clear();

      for (const callback of due) callback();
    },
    pendingTimers: () => timers.size,
  };
}

describe("startPreviewGlobe", () => {
  test("spins at rest, stops for a fly-to, and spins again once the pause ends", () => {
    const map = createFakeMap();
    const clock = createFakeClock();
    const preview = startPreviewGlobe(map, { ...clock, prefersReducedMotion: false });

    clock.runFrames(10);
    expect(map.longitude()).toBeLessThan(0);

    preview.focus([135, -25]);

    const afterFocus = map.longitude();

    clock.runFrames(10);
    expect(map.longitude()).toBe(afterFocus);
    expect(map.flights).toEqual([{ center: [135, -25], zoom: 1 }]);

    clock.runTimers();
    clock.runFrames(10);
    expect(map.longitude()).toBeLessThan(afterFocus);
  });

  test("keeps the focused latitude within 50 degrees so the globe never tips toward a pole", () => {
    const map = createFakeMap();
    const clock = createFakeClock();
    const preview = startPreviewGlobe(map, { ...clock, prefersReducedMotion: false });

    preview.focus([-18, 65]);
    preview.focus([0, -80]);

    expect(map.flights.map((flight) => flight.center)).toEqual([
      [-18, 50],
      [0, -50],
    ]);
  });

  test("a second pick restarts the pause instead of stacking a second resume", () => {
    const map = createFakeMap();
    const clock = createFakeClock();
    const preview = startPreviewGlobe(map, { ...clock, prefersReducedMotion: false });

    preview.focus([10, 10]);
    preview.focus([20, 20]);

    expect(clock.pendingTimers()).toBe(1);
  });

  test("under reduced motion it never spins and never schedules a resume", () => {
    const map = createFakeMap();
    const clock = createFakeClock();
    const preview = startPreviewGlobe(map, { ...clock, prefersReducedMotion: true });

    clock.runFrames(10);
    preview.focus([10, 10]);

    expect(map.longitude()).toBe(0);
    expect(clock.pendingTimers()).toBe(0);
  });

  test("stop removes the globe and cancels a pending resume", () => {
    const map = createFakeMap();
    const clock = createFakeClock();
    const preview = startPreviewGlobe(map, { ...clock, prefersReducedMotion: false });

    preview.focus([10, 10]);
    preview.stop();

    expect(map.isRemoved()).toBe(true);
    expect(clock.pendingTimers()).toBe(0);
  });
});
