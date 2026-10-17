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

type GlobeOptions<T> = {
  initialMarks: Marks;
  frames: FrameScheduler;
  prefersReducedMotion: boolean;
  bindMapEvents: (map: T) => void;
};

export function startGlobe<T extends GlobeMap>(
  map: T,
  { initialMarks, frames, prefersReducedMotion, bindMapEvents }: GlobeOptions<T>,
) {
  const spin = createGlobeSpin(map, { prefersReducedMotion, frames });

  let unsubscribeStores: (() => void) | undefined;

  spin.stopOnUserInteraction();

  function handleStyleLoad() {
    bindMapEvents(map);
    spin.start();
    unsubscribeStores = bindStoreSync(map, initialMarks, spin.stop);
  }

  map.on("style.load", handleStyleLoad);

  return function unmount() {
    map.off("style.load", handleStyleLoad);
    spin.stop();
    unsubscribeStores?.();
    map.remove();
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
    center: [0, 20],
    zoom: 1.4,
    minZoom: 1,
    maxZoom: 8,
  });

  const unmount = startGlobe(map, {
    initialMarks,
    frames: window,
    prefersReducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    bindMapEvents: bindCountryEvents,
  });

  return { map, unmount };
}
