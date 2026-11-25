import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { countryCenter } from "@/features/countries";
import { marksStore } from "@/features/marks";
import { DEFAULT_CAMERA, startGlobe } from "@/features/globe/mount-globe";
import { createSelectionStore } from "@/features/globe/selected-country";

function createFakeMap() {
  const interactionListeners: Array<() => void> = [];
  const clickListeners: Array<(code: string) => void> = [];
  const calls: string[] = [];
  const flights: unknown[] = [];
  let center = { lng: 0, lat: 20 };
  let zoom = 1.4;

  return {
    getCenter: () => ({ ...center }),
    jumpTo: (options: { center: [number, number]; zoom?: number }) => {
      center = { lng: options.center[0], lat: options.center[1] };
      zoom = options.zoom ?? zoom;
      calls.push("jumpTo");
    },
    setMarks: () => {
      calls.push("setMarks");
    },
    setSelectedCode: () => {
      calls.push("setSelectedCode");
    },
    onCountryClick: (listener: (code: string) => void) => {
      clickListeners.push(listener);
    },
    flyTo: (options: { center: [number, number] }) => {
      flights.push(options.center);
      calls.push("flyTo");
    },
    getZoom: () => zoom,
    onUserInteraction: (listener: () => void) => {
      interactionListeners.push(listener);
    },
    interact: () => {
      for (const listener of interactionListeners) listener();
    },
    clickCountry: (code: string) => {
      for (const listener of clickListeners) listener(code);
    },
    moveCamera: (nextCenter: { lng: number; lat: number }, nextZoom: number) => {
      center = { ...nextCenter };
      zoom = nextZoom;
    },
    calls,
    flights,
    longitude: () => center.lng,
    camera: () => ({ center: [center.lng, center.lat], zoom }),
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

type FakeGlobeSetup = {
  prefersReducedMotion?: boolean;
  selection?: ReturnType<typeof createSelectionStore>;
};

function startFakeGlobe({
  prefersReducedMotion = false,
  selection = createSelectionStore(),
}: FakeGlobeSetup = {}) {
  const map = createFakeMap();
  const frames = createFakeFrames();

  const globe = startGlobe(map, {
    frames: frames.scheduler,
    stores: { marks: marksStore, selection },
    prefersReducedMotion,
  });

  return { map, frames, globe, selection };
}

function isTurning({ map, frames }: ReturnType<typeof startFakeGlobe>) {
  const before = map.longitude();

  frames.runFrames(3);

  return map.longitude() < before;
}

beforeEach(() => {
  marksStore.setState({ ownerId: null, marks: {} });
});

afterEach(() => {
  marksStore.setState({ ownerId: null, marks: {} });
});

describe("globe lifecycle", () => {
  test("spins once started and runs no frame while paused", () => {
    const started = startFakeGlobe();

    started.frames.runFrames(3);

    expect(started.frames.scheduledCount()).toBe(1);
    expect(started.map.longitude()).toBeLessThan(0);

    started.globe.pause();

    expect(started.frames.scheduledCount()).toBe(0);
    expect(isTurning(started)).toBe(false);
  });

  test("a paused globe keeps its camera and spins again from it when resumed", () => {
    const started = startFakeGlobe();

    started.map.moveCamera({ lng: 42, lat: -12 }, 3.5);
    started.globe.pause();
    started.frames.runFrames(5);

    expect(started.map.camera()).toEqual({ center: [42, -12], zoom: 3.5 });

    started.globe.resume();
    started.frames.runFrames(1);

    expect(started.map.longitude()).toBe(42);
    expect(isTurning(started)).toBe(true);
  });

  test("a spin the user stopped stays stopped after a pause and a resume", () => {
    const started = startFakeGlobe();

    started.frames.runFrames(2);
    started.map.interact();
    started.globe.pause();
    started.globe.resume();

    expect(started.frames.scheduledCount()).toBe(0);
    expect(started.globe.isSpinning()).toBe(false);
  });

  test("reduced motion starts no spin", () => {
    const started = startFakeGlobe({ prefersReducedMotion: true });

    started.frames.runFrames(3);

    expect(started.frames.scheduledCount()).toBe(0);
    expect(started.globe.isSpinning()).toBe(false);
  });

  test("a search made before the globe starts flies there once it starts", () => {
    const selection = createSelectionStore();

    selection.getState().selectAndFly("JPN");

    const started = startFakeGlobe({ selection });

    expect(started.map.flights).toEqual([countryCenter("JPN")]);
    expect(selection.getState().pendingFlyCode).toBeNull();
  });

  test("store changes while paused reach no map method", () => {
    const started = startFakeGlobe();

    marksStore.setState({ marks: { DEU: "want" } });

    expect(started.map.calls).toContain("setMarks");

    started.globe.pause();
    started.map.calls.length = 0;
    marksStore.setState({ marks: { FRA: "visited" } });
    started.selection.getState().select("JPN");

    expect(started.map.calls).toEqual([]);
  });

  test("resuming paints the marks and the selection made while paused, and flies to a pending search", () => {
    const started = startFakeGlobe();

    started.globe.pause();
    started.map.calls.length = 0;
    marksStore.setState({ marks: { FRA: "visited" } });
    started.selection.getState().selectAndFly("BRA");
    started.globe.resume();

    expect(started.map.calls).toEqual(["setMarks", "setSelectedCode", "flyTo"]);
    expect(started.map.flights).toEqual([countryCenter("BRA")]);
    expect(started.globe.isSpinning()).toBe(false);
  });

  test("resuming twice binds the stores once", () => {
    const started = startFakeGlobe();

    started.globe.resume();
    started.map.calls.length = 0;
    marksStore.setState({ marks: { FRA: "visited" } });

    expect(started.map.calls).toEqual(["setMarks"]);
  });

  test("a click on a country selects it once, however often the globe was paused", () => {
    const started = startFakeGlobe();
    const selections: (string | null)[] = [];

    started.globe.pause();
    started.globe.resume();
    started.selection.subscribe((state) => selections.push(state.selectedCode));
    started.map.clickCountry("UNK");

    expect(selections).toEqual(["UNK"]);
  });
});

describe("on an account change", () => {
  function moveAndSelect(started: ReturnType<typeof startFakeGlobe>) {
    started.map.moveCamera({ lng: 42, lat: -12 }, 3.5);
    started.map.interact();
    started.selection.getState().select("JPN");
  }

  test("the first sign-in keeps the selected country and the camera", () => {
    const started = startFakeGlobe();

    moveAndSelect(started);
    marksStore.setState({ ownerId: "user_a" });

    expect(started.selection.getState().selectedCode).toBe("JPN");
    expect(started.map.camera()).toEqual({ center: [42, -12], zoom: 3.5 });
  });

  test("a marks change for the same account keeps the selected country and the camera", () => {
    marksStore.setState({ ownerId: "user_a" });

    const started = startFakeGlobe();

    moveAndSelect(started);
    marksStore.setState({ marks: { JPN: "visited" } });

    expect(started.selection.getState().selectedCode).toBe("JPN");
    expect(started.map.camera()).toEqual({ center: [42, -12], zoom: 3.5 });
  });

  for (const [change, nextOwnerId] of [
    ["signing out", null],
    ["another account signing in", "user_b"],
  ] as const) {
    test(`${change} clears the selected country and returns to the default camera, spinning`, () => {
      marksStore.setState({ ownerId: "user_a" });

      const started = startFakeGlobe();

      moveAndSelect(started);
      marksStore.setState({ ownerId: nextOwnerId });

      expect(started.selection.getState()).toMatchObject({
        selectedCode: null,
        pendingFlyCode: null,
      });
      expect(started.map.camera()).toEqual(DEFAULT_CAMERA);
      expect(isTurning(started)).toBe(true);
    });
  }

  test("an account change while paused resets the camera and spins only once resumed", () => {
    marksStore.setState({ ownerId: "user_a" });

    const started = startFakeGlobe();

    moveAndSelect(started);
    started.globe.pause();
    marksStore.setState({ ownerId: "user_b" });

    expect(started.map.camera()).toEqual(DEFAULT_CAMERA);
    expect(started.frames.scheduledCount()).toBe(0);

    started.globe.resume();

    expect(isTurning(started)).toBe(true);
  });

  test("an account change with reduced motion resets the camera without spinning", () => {
    marksStore.setState({ ownerId: "user_a" });

    const started = startFakeGlobe({ prefersReducedMotion: true });

    moveAndSelect(started);
    marksStore.setState({ ownerId: "user_b" });

    expect(started.map.camera()).toEqual(DEFAULT_CAMERA);
    expect(started.frames.scheduledCount()).toBe(0);
  });
});
