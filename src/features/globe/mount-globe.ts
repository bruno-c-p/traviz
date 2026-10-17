import type mapboxgl from "mapbox-gl";
import { bindCountryEvents } from "@/features/globe/map-country-events";
import { createGlobeSpin } from "@/features/globe/map-spin";
import type { FrameScheduler, SpinnableMap } from "@/features/globe/map-spin";
import { bindStoreSync } from "@/features/globe/map-store-sync";
import type { SyncedMap } from "@/features/globe/map-store-sync";
import { buildMapStyle } from "@/features/globe/map-style";
import type { Marks } from "@/features/marks";
import { useCountriesStore } from "@/features/marks";
import { useSelectedCountryStore } from "@/features/globe/selected-country";

type GlobeMap = SpinnableMap &
  SyncedMap & {
    on: (type: "style.load", listener: () => void) => void;
    off: (type: "style.load", listener: () => void) => void;
    remove: () => void;
  };

export type GlobeCamera = { center: [number, number]; zoom: number; isSpinning: boolean };

type GlobeOptions<T> = {
  initialMarks: Marks;
  frames: FrameScheduler;
  isSpinning: boolean;
  bindMapEvents: (map: T) => void;
};

let lastCamera: GlobeCamera = { center: [0, 20], zoom: 1.4, isSpinning: true };

export function startGlobe<T extends GlobeMap>(
  map: T,
  { initialMarks, frames, isSpinning, bindMapEvents }: GlobeOptions<T>,
) {
  const spin = createGlobeSpin(map, { startsStopped: !isSpinning, frames });

  let unsubscribeStores: (() => void) | undefined;

  spin.stopOnUserInteraction();

  function handleStyleLoad() {
    bindMapEvents(map);
    spin.start();
    unsubscribeStores = bindStoreSync(map, initialMarks, spin.stop);
  }

  map.on("style.load", handleStyleLoad);

  return function unmount(): GlobeCamera {
    const { lng, lat } = map.getCenter();

    const camera: GlobeCamera = {
      center: [lng, lat],
      zoom: map.getZoom(),
      isSpinning: !spin.isStopped(),
    };

    map.off("style.load", handleStyleLoad);
    spin.stop();
    unsubscribeStores?.();
    map.remove();

    return camera;
  };
}

export function mountGlobe(mapbox: typeof mapboxgl, container: HTMLDivElement) {
  const initialMarks = useCountriesStore.getState().marks;
  const initialSelectedCode = useSelectedCountryStore.getState().selectedCode;

  const map = new mapbox.Map({
    container,
    accessToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
    style: buildMapStyle(initialMarks, initialSelectedCode),
    localFontFamily: getComputedStyle(container).fontFamily,
    projection: "globe",
    center: lastCamera.center,
    zoom: lastCamera.zoom,
    minZoom: 1,
    maxZoom: 8,
  });

  const unmountGlobe = startGlobe(map, {
    initialMarks,
    frames: window,
    isSpinning:
      lastCamera.isSpinning && !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    bindMapEvents: bindCountryEvents,
  });

  function unmount() {
    lastCamera = unmountGlobe();
  }

  return { map, unmount };
}
