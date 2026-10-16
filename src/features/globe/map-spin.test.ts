import { describe, expect, test } from "bun:test";
import { createGlobeSpin } from "@/features/globe/map-spin";

type CameraEvent = { originalEvent?: unknown };

const FRAME_MS = 16;
const USER_EVENT = { originalEvent: { type: "pointermove" } };

function createFakeMapbox() {
  const listeners = new Map<string, Array<(event: CameraEvent) => void>>();
  let center = { lng: 0, lat: 20 };
  let isGestureCancelled = false;

  function fire(type: string, event: CameraEvent = {}) {
    for (const listener of listeners.get(type) ?? []) listener(event);
  }

  return {
    getCenter: () => ({ ...center }),
    jumpTo: (options: { center: { lng: number; lat: number } }) => {
      center = { ...options.center };
      fire("movestart");
    },
    on: (type: string, listener: (event: CameraEvent) => void) => {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    },
    stop: () => {
      isGestureCancelled = true;
    },
    fire,
    longitude: () => center.lng,
    isGestureCancelled: () => isGestureCancelled,
  };
}

function createFakeFrames() {
  const pending = new Map<number, (now: number) => void>();
  let nextFrameId = 1;
  let now = 0;

  return {
    scheduler: {
      request: (callback: (now: number) => void) => {
        const frameId = nextFrameId++;
        pending.set(frameId, callback);

        return frameId;
      },
      cancel: (frameId: number) => {
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

type SpinSetup = { isSpinAllowed?: () => boolean; prefersReducedMotion?: boolean };

function startSpin({ isSpinAllowed = () => true, prefersReducedMotion = false }: SpinSetup = {}) {
  const map = createFakeMapbox();
  const frames = createFakeFrames();

  const spin = createGlobeSpin(map, {
    isSpinAllowed,
    prefersReducedMotion,
    frames: frames.scheduler,
  });

  spin.stopOnUserInteraction();
  spin.start();
  frames.runFrames(2);

  return { map, frames, spin };
}

function isSpinning({ map, frames }: ReturnType<typeof startSpin>) {
  const before = map.longitude();
  frames.runFrames(3);

  return map.longitude() < before;
}

describe("globe spin", () => {
  test("turns the globe westward on each frame", () => {
    const spinning = startSpin();

    expect(spinning.map.longitude()).toBeCloseTo(-1.5 * (FRAME_MS / 1000));
    expect(isSpinning(spinning)).toBe(true);
  });

  test("keeps spinning through its own camera moves, which carry no originalEvent", () => {
    const spinning = startSpin();

    expect(isSpinning(spinning)).toBe(true);
    expect(isSpinning(spinning)).toBe(true);
  });

  test("never starts when the user prefers reduced motion", () => {
    const spinning = startSpin({ prefersReducedMotion: true });

    expect(spinning.map.longitude()).toBe(0);
    expect(isSpinning(spinning)).toBe(false);
  });

  test("holds still while spinning is not allowed and resumes when it is", () => {
    let isAllowed = false;
    const spinning = startSpin({ isSpinAllowed: () => isAllowed });

    expect(isSpinning(spinning)).toBe(false);

    isAllowed = true;

    expect(isSpinning(spinning)).toBe(true);
  });

  test("stops on the first user drag without cancelling that drag", () => {
    const spinning = startSpin();

    spinning.map.fire("movestart", USER_EVENT);

    expect(isSpinning(spinning)).toBe(false);
    expect(spinning.map.isGestureCancelled()).toBe(false);
  });

  test.each([
    ["a click", "click"],
    ["a mouse press", "mousedown"],
    ["a touch", "touchstart"],
    ["a wheel turn", "wheel"],
    ["a zoom button press", "zoomstart"],
  ])("stops for good on %s", (_label, type) => {
    const spinning = startSpin();

    spinning.map.fire(type);

    expect(isSpinning(spinning)).toBe(false);
    expect(spinning.map.isGestureCancelled()).toBe(false);
  });

  test("stays stopped when stopped during its own camera move", () => {
    const spinning = startSpin();

    spinning.map.on("movestart", spinning.spin.stop);
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
