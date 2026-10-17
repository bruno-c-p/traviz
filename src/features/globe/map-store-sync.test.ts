import { beforeEach, describe, expect, test } from "bun:test";
import { countries, searchCountries } from "@/features/countries";
import { createGlobeSpin } from "@/features/globe/map-spin";
import type { SpinnableMap } from "@/features/globe/map-spin";
import { bindStoreSync } from "@/features/globe/map-store-sync";
import type { SyncedMap } from "@/features/globe/map-store-sync";
import { useSelectedCountryStore } from "@/features/globe/selected-country";

function recordingMap() {
  const flights: [number, number][] = [];

  const map: SyncedMap = {
    setPaintProperty: () => undefined,
    setFilter: () => undefined,
    flyTo: (options) => flights.push(options.center),
    getZoom: () => 1.4,
  };

  return { map, flights };
}

function spinningGlobe() {
  const cameraMoves: string[] = [];
  const pendingFrames = new Map<number, (now: number) => void>();
  let center = { lng: 0, lat: 20 };
  let nextFrameId = 1;
  let now = 0;

  const map = {
    getCenter: () => ({ ...center }),
    jumpTo: (options: { center: { lng: number; lat: number } }) => {
      center = { ...options.center };
      cameraMoves.push("spin");
    },
    on: () => undefined,
    setPaintProperty: () => undefined,
    setFilter: () => undefined,
    flyTo: (options: { center: [number, number] }) => {
      center = { lng: options.center[0], lat: options.center[1] };
      cameraMoves.push("fly");
    },
    getZoom: () => 1.4,
  } satisfies SpinnableMap & SyncedMap;

  const spin = createGlobeSpin(map, {
    startsStopped: false,
    frames: {
      requestAnimationFrame: (callback: (now: number) => void) => {
        const frameId = nextFrameId++;
        pendingFrames.set(frameId, callback);

        return frameId;
      },
      cancelAnimationFrame: (frameId: number) => {
        pendingFrames.delete(frameId);
      },
    },
  });

  function runFrames(count: number) {
    for (let frame = 0; frame < count; frame++) {
      now += 16;
      const due = [...pendingFrames.values()];

      pendingFrames.clear();

      for (const callback of due) callback(now);
    }
  }

  function loadStyle() {
    spin.start();

    return bindStoreSync(map, {}, spin.stop);
  }

  return { cameraMoves, runFrames, loadStyle, center: () => [center.lng, center.lat] };
}

function searchAndChoose(query: string, code: string) {
  const match = searchCountries(query).find((country) => country.code === code);

  if (!match) throw new Error(`Searching "${query}" did not find ${code}`);

  useSelectedCountryStore.getState().selectAndFly(match.code);
}

describe("globe search fly-to", () => {
  beforeEach(() => {
    useSelectedCountryStore.setState({ selectedCode: null, pendingFlyCode: null });
  });

  test("choosing any entry from a search of its name flies the globe to its center", () => {
    const { map, flights } = recordingMap();
    const unbind = bindStoreSync(map, {}, () => undefined);

    const missedCenter = countries.flatMap((country) => {
      const flightsBefore = flights.length;

      searchAndChoose(country.name, country.code);

      const [longitude, latitude] = flights.at(-1) ?? [];

      const flewToCenter =
        flights.length === flightsBefore + 1 &&
        longitude === country.center[0] &&
        latitude === country.center[1];

      return flewToCenter ? [] : [country.code];
    });

    unbind();

    expect(missedCenter).toEqual([]);
  });

  test("searching united s and choosing the Minor Outlying Islands flies there", () => {
    const { map, flights } = recordingMap();
    const unbind = bindStoreSync(map, {}, () => undefined);

    searchAndChoose("united s", "UMI");
    unbind();

    expect(flights).toEqual([[166.633333, 19.3]]);
  });

  test("a search made before the style loads flies there once the sync binds", () => {
    const { map, flights } = recordingMap();

    searchAndChoose("japan", "JPN");

    const unbind = bindStoreSync(map, {}, () => undefined);
    unbind();

    expect(flights).toEqual([[138, 36]]);
  });

  test("of two searches made before the style loads, only the latest flies once the sync binds", () => {
    const { map, flights } = recordingMap();

    searchAndChoose("japan", "JPN");
    searchAndChoose("france", "FRA");
    bindStoreSync(map, {}, () => undefined)();

    expect(flights).toEqual([[2, 46]]);
  });

  test("a search closed before the style loads does not fly", () => {
    const { map, flights } = recordingMap();

    searchAndChoose("japan", "JPN");
    useSelectedCountryStore.getState().clearSelection();
    bindStoreSync(map, {}, () => undefined)();

    expect(flights).toEqual([]);
  });

  test("binding again after a replayed fly does not fly a second time", () => {
    const { map, flights } = recordingMap();

    searchAndChoose("japan", "JPN");
    bindStoreSync(map, {}, () => undefined)();
    bindStoreSync(map, {}, () => undefined)();

    expect(flights).toHaveLength(1);
  });

  test("a fly replayed when the style loads stops the spin, so no spin frame moves the camera after it", () => {
    const globe = spinningGlobe();

    searchAndChoose("japan", "JPN");

    const unbind = globe.loadStyle();
    globe.runFrames(10);
    unbind();

    expect(globe.cameraMoves).toEqual(["fly"]);
    expect(globe.center()).toEqual([138, 36]);
  });

  test("no spin frame moves the camera after a search flies", () => {
    const globe = spinningGlobe();
    const unbind = globe.loadStyle();

    globe.runFrames(5);
    searchAndChoose("japan", "JPN");
    globe.runFrames(10);
    unbind();

    expect(globe.cameraMoves.filter((move) => move === "fly")).toHaveLength(1);
    expect(globe.cameraMoves.at(-1)).toBe("fly");
    expect(globe.center()).toEqual([138, 36]);
  });
});
