import { beforeEach, describe, expect, test } from "bun:test";
import { countryCenter } from "@/features/countries";
import { useCountriesStore } from "@/features/marks";
import { startGlobe } from "@/features/globe/mount-globe";
import { useSelectedCountryStore } from "@/features/globe/selected-country";

type MapEvent = { originalEvent?: unknown };

function createFakeMap() {
  const listeners = new Map<string, Array<(event: MapEvent) => void>>();
  const calls: string[] = [];
  const flights: unknown[] = [];
  let center = { lng: 0, lat: 20 };
  let removals = 0;

  return {
    getCenter: () => ({ ...center }),
    jumpTo: (options: { center: { lng: number; lat: number } }) => {
      center = { ...options.center };
      calls.push("jumpTo");
    },
    setPaintProperty: () => {
      calls.push("setPaintProperty");
    },
    setFilter: () => {
      calls.push("setFilter");
    },
    flyTo: (options: { center: [number, number] }) => {
      flights.push(options.center);
      calls.push("flyTo");
    },
    getZoom: () => 1.4,
    on: (type: string, listener: (event: MapEvent) => void) => {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    },
    off: (type: string, listener: (event: MapEvent) => void) => {
      listeners.set(
        type,
        (listeners.get(type) ?? []).filter((registered) => registered !== listener),
      );
    },
    remove: () => {
      removals++;
    },
    loadStyle: () => {
      for (const listener of listeners.get("style.load") ?? []) listener({});
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

function mountFakeGlobe() {
  const map = createFakeMap();
  const frames = createFakeFrames();
  let mapEventBindings = 0;

  const unmount = startGlobe(map, {
    initialMarks: useCountriesStore.getState().marks,
    frames: frames.scheduler,
    prefersReducedMotion: false,
    bindMapEvents: () => {
      mapEventBindings++;
    },
  });

  return { map, frames, unmount, mapEventBindings: () => mapEventBindings };
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

  test("spins after the style loads and leaves no frame running after unmount", () => {
    const globe = mountFakeGlobe();

    globe.map.loadStyle();
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

  test("a style that loads after unmount starts nothing", () => {
    const globe = mountFakeGlobe();

    globe.unmount();
    globe.map.loadStyle();
    changeMarksAndSelection();
    globe.frames.runFrames(5);

    expect(globe.frames.scheduledCount()).toBe(0);
    expect(globe.mapEventBindings()).toBe(0);
    expect(globe.map.calls).toEqual([]);
  });

  test("a search made before any globe mounts flies there once the next globe loads", () => {
    useSelectedCountryStore.getState().selectAndFly("JPN");

    const globe = mountFakeGlobe();
    globe.map.loadStyle();
    globe.unmount();

    expect(globe.map.flights).toEqual([countryCenter("JPN")]);
    expect(useSelectedCountryStore.getState().pendingFlyCode).toBeNull();
  });

  test("a search made while a globe loads survives its unmount and flies on the next globe", () => {
    const leftGlobe = mountFakeGlobe();

    useSelectedCountryStore.getState().selectAndFly("JPN");
    leftGlobe.unmount();

    const nextGlobe = mountFakeGlobe();
    nextGlobe.map.loadStyle();
    nextGlobe.unmount();

    expect(leftGlobe.map.flights).toEqual([]);
    expect(nextGlobe.map.flights).toEqual([countryCenter("JPN")]);
    expect(useSelectedCountryStore.getState().pendingFlyCode).toBeNull();
  });

  test("store changes after unmount reach no map method", () => {
    const globe = mountFakeGlobe();

    globe.map.loadStyle();
    useCountriesStore.setState({ marks: { DEU: "want" } });

    expect(globe.map.calls).toContain("setPaintProperty");

    globe.unmount();
    globe.map.calls.length = 0;
    changeMarksAndSelection();

    expect(globe.map.calls).toEqual([]);
  });
});
