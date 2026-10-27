import { describe, expect, test } from "bun:test";
import { createGlobeSpin } from "@/features/globe/map-spin";

const FRAME_MS = 16;

function createFakeGlobe() {
  const interactionListeners: Array<() => void> = [];
  const moveListeners: Array<() => void> = [];
  let center = { lng: 0, lat: 20 };

  return {
    getCenter: () => ({ ...center }),
    jumpTo: (options: { center: [number, number] }) => {
      center = { lng: options.center[0], lat: options.center[1] };

      for (const listener of moveListeners) listener();
    },
    onUserInteraction: (listener: () => void) => {
      interactionListeners.push(listener);
    },
    onMove: (listener: () => void) => {
      moveListeners.push(listener);
    },
    interact: () => {
      for (const listener of interactionListeners) listener();
    },
    longitude: () => center.lng,
    latitude: () => center.lat,
  };
}

function createFakeFrames() {
  const pending = new Map<number, (now: number) => void>();
  let nextFrameId = 1;
  let now = 0;

  return {
    scheduler: {
      requestAnimationFrame: (callback: (now: number) => void) => {
        const frameId = nextFrameId++;
        pending.set(frameId, callback);

        return frameId;
      },
      cancelAnimationFrame: (frameId: number) => {
        pending.delete(frameId);
      },
    },
    runFrames: (count: number) => {
      for (let frame = 0; frame < count; frame++) {
        now += FRAME_MS;
        const due = [...pending.values()];

        pending.clear();

        for (const callback of due) callback(now);
      }
    },
  };
}

type SpinSetup = { startsStopped?: boolean };

function startSpin({ startsStopped = false }: SpinSetup = {}) {
  const globe = createFakeGlobe();
  const frames = createFakeFrames();

  const spin = createGlobeSpin(globe, {
    startsStopped,
    frames: frames.scheduler,
  });

  spin.stopOnUserInteraction();
  spin.start();
  frames.runFrames(2);

  return { globe, frames, spin };
}

function isSpinning({ globe, frames }: ReturnType<typeof startSpin>) {
  const before = globe.longitude();
  frames.runFrames(3);

  return globe.longitude() < before;
}

describe("globe spin", () => {
  test("turns the globe westward on each frame and keeps its latitude", () => {
    const spinning = startSpin();

    expect(spinning.globe.longitude()).toBeCloseTo(-1.5 * (FRAME_MS / 1000));
    expect(spinning.globe.latitude()).toBe(20);
  });

  test("keeps spinning through its own camera moves", () => {
    const spinning = startSpin();

    expect(isSpinning(spinning)).toBe(true);
    expect(isSpinning(spinning)).toBe(true);
  });

  test("never starts when created stopped", () => {
    const spinning = startSpin({ startsStopped: true });

    expect(spinning.globe.longitude()).toBe(0);
    expect(isSpinning(spinning)).toBe(false);
    expect(spinning.spin.isStopped()).toBe(true);
  });

  test("stops for good on the first user interaction", () => {
    const spinning = startSpin();

    expect(spinning.spin.isStopped()).toBe(false);

    spinning.globe.interact();

    expect(isSpinning(spinning)).toBe(false);
    expect(spinning.spin.isStopped()).toBe(true);
  });

  test("ignores a second start while already spinning", () => {
    const spinning = startSpin();

    spinning.spin.start();
    spinning.spin.stop();

    expect(isSpinning(spinning)).toBe(false);
  });

  test("stays stopped when stopped during its own camera move", () => {
    const spinning = startSpin();

    spinning.globe.onMove(spinning.spin.stop);
    spinning.frames.runFrames(1);

    expect(isSpinning(spinning)).toBe(false);
  });

  test("stays stopped when started again after a stop", () => {
    const spinning = startSpin();

    spinning.spin.stop();
    spinning.spin.start();

    expect(isSpinning(spinning)).toBe(false);
  });
});
