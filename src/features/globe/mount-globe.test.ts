import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { countryCenter } from "@/features/countries";
import { useCountriesStore } from "@/features/marks";
import {
  createCameraHandoff,
  resetGlobeOnAccountChange,
  startGlobe,
} from "@/features/globe/mount-globe";
import type { GlobeCamera } from "@/features/globe/mount-globe";
import { useSelectedCountryStore } from "@/features/globe/selected-country";

function createFakeMap() {
  const interactionListeners: Array<() => void> = [];
  const calls: string[] = [];
  const flights: unknown[] = [];
  let center = { lng: 0, lat: 20 };
  let zoom = 1.4;
  let removals = 0;

  return {
    getCenter: () => ({ ...center }),
    jumpTo: (options: { center: [number, number] }) => {
      center = { lng: options.center[0], lat: options.center[1] };
      calls.push("jumpTo");
    },
    setMarks: () => {
      calls.push("setMarks");
    },
    setSelectedCode: () => {
      calls.push("setSelectedCode");
    },
    onCountryClick: () => undefined,
    flyTo: (options: { center: [number, number] }) => {
      flights.push(options.center);
      calls.push("flyTo");
    },
    getZoom: () => zoom,
    onUserInteraction: (listener: () => void) => {
      interactionListeners.push(listener);
    },
    remove: () => {
      removals++;
    },
    interact: () => {
      for (const listener of interactionListeners) listener();
    },
    moveCamera: (nextCenter: { lng: number; lat: number }, nextZoom: number) => {
      center = { ...nextCenter };
      zoom = nextZoom;
    },
    calls,
    flights,
    longitude: () => center.lng,
    removals: () => removals,
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
        now += 16;
        const due = [...pending.values()];

        pending.clear();

        for (const callback of due) callback(now);
      }
    },
    scheduledCount: () => pending.size,
  };
}

function mountFakeGlobe({ isSpinning = true }: { isSpinning?: boolean } = {}) {
  const map = createFakeMap();
  const frames = createFakeFrames();
  const unmount = startGlobe(map, { frames: frames.scheduler, isSpinning });

  return { map, frames, unmount };
}

function changeMarksAndSelection() {
  useCountriesStore.setState({ marks: { FRA: "visited" } });
  useSelectedCountryStore.getState().select("JPN");
  useSelectedCountryStore.getState().selectAndFly("BRA");
}

describe("globe lifecycle", () => {
  beforeEach(() => {
    useCountriesStore.setState({ marks: {} });
    useSelectedCountryStore.setState({ selectedCode: null, pendingFlyCode: null });
  });

  test("spins once started and leaves no frame running after unmount", () => {
    const globe = mountFakeGlobe();

    globe.frames.runFrames(3);

    expect(globe.frames.scheduledCount()).toBe(1);
    expect(globe.map.longitude()).toBeLessThan(0);

    globe.unmount();
    const longitudeAtUnmount = globe.map.longitude();
    globe.frames.runFrames(5);

    expect(globe.frames.scheduledCount()).toBe(0);
    expect(globe.map.longitude()).toBe(longitudeAtUnmount);
    expect(globe.map.removals()).toBe(1);
  });

  test("a search made before any globe mounts flies there once the next globe starts", () => {
    useSelectedCountryStore.getState().selectAndFly("JPN");

    const globe = mountFakeGlobe();
    globe.unmount();

    expect(globe.map.flights).toEqual([countryCenter("JPN")]);
    expect(useSelectedCountryStore.getState().pendingFlyCode).toBeNull();
  });

  test("store changes after unmount reach no map method", () => {
    const globe = mountFakeGlobe();

    useCountriesStore.setState({ marks: { DEU: "want" } });

    expect(globe.map.calls).toContain("setMarks");

    globe.unmount();
    globe.map.calls.length = 0;
    changeMarksAndSelection();

    expect(globe.map.calls).toEqual([]);
  });

  test("reports the camera it ends with, still spinning when the user never touched it", () => {
    const globe = mountFakeGlobe();

    globe.map.moveCamera({ lng: 42, lat: -12 }, 3.5);

    expect(globe.unmount()).toEqual({ center: [42, -12], zoom: 3.5, isSpinning: true });
  });

  test("reports a spin the user stopped as not spinning", () => {
    const globe = mountFakeGlobe();

    globe.frames.runFrames(2);
    globe.map.interact();

    expect(globe.unmount().isSpinning).toBe(false);
  });

  test("a globe started without spin schedules no frame", () => {
    const globe = mountFakeGlobe({ isSpinning: false });

    globe.frames.runFrames(3);

    expect(globe.frames.scheduledCount()).toBe(0);
    expect(globe.unmount().isSpinning).toBe(false);
  });
});

describe("camera handoff", () => {
  function mountFrom(
    { mountFromLastCamera }: ReturnType<typeof createCameraHandoff>,
    { prefersReducedMotion = false }: { prefersReducedMotion?: boolean } = {},
  ) {
    const frames = createFakeFrames();
    const cameras: GlobeCamera[] = [];

    const globe = mountFromLastCamera(
      (camera) => {
        cameras.push(camera);

        return createFakeMap();
      },
      {
        frames: frames.scheduler,
        prefersReducedMotion,
      },
    );

    return { ...globe, frames, cameras };
  }

  test("the next globe starts from the last globe's camera and keeps its stopped spin", () => {
    const handoff = createCameraHandoff();
    const firstGlobe = mountFrom(handoff);

    firstGlobe.map.moveCamera({ lng: 42, lat: -12 }, 3.5);
    firstGlobe.map.interact();
    firstGlobe.unmount();

    const nextGlobe = mountFrom(handoff);
    nextGlobe.frames.runFrames(3);

    expect(nextGlobe.cameras).toEqual([{ center: [42, -12], zoom: 3.5, isSpinning: false }]);
    expect(nextGlobe.frames.scheduledCount()).toBe(0);

    nextGlobe.unmount();
  });

  test("the next globe keeps spinning when the user never stopped the last one", () => {
    const handoff = createCameraHandoff();

    mountFrom(handoff).unmount();

    const nextGlobe = mountFrom(handoff);
    nextGlobe.frames.runFrames(3);

    expect(nextGlobe.frames.scheduledCount()).toBe(1);

    nextGlobe.unmount();
  });

  describe("on an account change", () => {
    const MOVED_CAMERA: GlobeCamera = { center: [42, -12], zoom: 3.5, isSpinning: false };
    const DEFAULT_CAMERA: GlobeCamera = { center: [0, 20], zoom: 1.4, isSpinning: true };

    let unbind = () => {};

    afterEach(() => {
      unbind();
      useCountriesStore.setState({ ownerId: null, marks: {} });
      useSelectedCountryStore.setState({ selectedCode: null, pendingFlyCode: null });
    });

    function bindHandoff() {
      const handoff = createCameraHandoff();
      unbind = resetGlobeOnAccountChange(handoff);

      return handoff;
    }

    function leaveGlobeMovedAndSelected(handoff: ReturnType<typeof createCameraHandoff>) {
      const globe = mountFrom(handoff);
      globe.map.moveCamera({ lng: 42, lat: -12 }, 3.5);
      globe.map.interact();
      globe.unmount();
      useSelectedCountryStore.getState().selectAndFly("JPN");
    }

    function nextCamera(handoff: ReturnType<typeof createCameraHandoff>) {
      const globe = mountFrom(handoff);
      globe.unmount();

      return globe.cameras[0];
    }

    test("the first sign-in keeps the selected country and the camera", () => {
      const handoff = bindHandoff();
      leaveGlobeMovedAndSelected(handoff);

      useCountriesStore.setState({ ownerId: "user_a" });

      expect(useSelectedCountryStore.getState()).toMatchObject({
        selectedCode: "JPN",
        pendingFlyCode: "JPN",
      });
      expect(nextCamera(handoff)).toEqual(MOVED_CAMERA);
    });

    test("a marks change for the same account keeps the selected country and the camera", () => {
      const handoff = bindHandoff();
      useCountriesStore.setState({ ownerId: "user_a" });
      leaveGlobeMovedAndSelected(handoff);

      useCountriesStore.setState({ marks: { JPN: "visited" } });

      expect(useSelectedCountryStore.getState().selectedCode).toBe("JPN");
      expect(nextCamera(handoff)).toEqual(MOVED_CAMERA);
    });

    for (const [change, nextOwnerId] of [
      ["signing out", null],
      ["another account signing in", "user_b"],
    ] as const) {
      test(`${change} clears the selected country and starts the next globe from the default camera`, () => {
        const handoff = bindHandoff();
        useCountriesStore.setState({ ownerId: "user_a" });
        leaveGlobeMovedAndSelected(handoff);

        useCountriesStore.setState({ ownerId: nextOwnerId });

        expect(useSelectedCountryStore.getState()).toMatchObject({
          selectedCode: null,
          pendingFlyCode: null,
        });
        expect(nextCamera(handoff)).toEqual(DEFAULT_CAMERA);
      });
    }

    function moveMountedGlobe(handoff: ReturnType<typeof createCameraHandoff>) {
      const globe = mountFrom(handoff);
      globe.map.moveCamera({ lng: 42, lat: -12 }, 3.5);
      globe.map.interact();

      return globe;
    }

    test("an account change while a globe is mounted starts the next globe from the default camera", () => {
      const handoff = bindHandoff();
      useCountriesStore.setState({ ownerId: "user_a" });
      const globe = moveMountedGlobe(handoff);

      useCountriesStore.setState({ ownerId: "user_b" });
      globe.unmount();

      expect(nextCamera(handoff)).toEqual(DEFAULT_CAMERA);
    });

    test("a mounted globe with no account change hands its camera to the next globe", () => {
      const handoff = bindHandoff();
      useCountriesStore.setState({ ownerId: "user_a" });
      const globe = moveMountedGlobe(handoff);

      useCountriesStore.setState({ marks: { JPN: "visited" } });
      globe.unmount();

      expect(nextCamera(handoff)).toEqual(MOVED_CAMERA);
    });

    test("a globe mounted after an account change hands its camera to the next globe", () => {
      const handoff = bindHandoff();
      useCountriesStore.setState({ ownerId: "user_a" });
      useCountriesStore.setState({ ownerId: "user_b" });

      moveMountedGlobe(handoff).unmount();

      expect(nextCamera(handoff)).toEqual(MOVED_CAMERA);
    });
  });

  test("reduced motion starts no spin", () => {
    const globe = mountFrom(createCameraHandoff(), { prefersReducedMotion: true });

    globe.frames.runFrames(3);

    expect(globe.frames.scheduledCount()).toBe(0);

    globe.unmount();
  });
});
