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

type HandoffOptions<T> = Omit<GlobeOptions<T>, "isSpinning"> & { prefersReducedMotion: boolean };

const DEFAULT_CAMERA: GlobeCamera = { center: [0, 20], zoom: 1.4, isSpinning: true };

export function createCameraHandoff() {
  let lastCamera = DEFAULT_CAMERA;

  function mountFromLastCamera<T extends GlobeMap>(
    createMap: (camera: GlobeCamera) => T,
    { prefersReducedMotion, ...options }: HandoffOptions<T>,
  ) {
    const map = createMap(lastCamera);

    const unmountGlobe = startGlobe(map, {
      ...options,
      isSpinning: lastCamera.isSpinning && !prefersReducedMotion,
    });

    function unmount() {
      lastCamera = unmountGlobe();
    }

    return { map, unmount };
  }

  return {
    mountFromLastCamera,
    reset: () => {
      lastCamera = DEFAULT_CAMERA;
    },
  };
}

export function resetGlobeOnAccountChange(handoff: { reset: () => void }) {
  return useCountriesStore.subscribe((state, previousState) => {
    if (previousState.ownerId === null || state.ownerId === previousState.ownerId) return;

    useSelectedCountryStore.getState().clearSelection();
    handoff.reset();
  });
}

const cameraHandoff = createCameraHandoff();

resetGlobeOnAccountChange(cameraHandoff);

export function mountGlobe(mapbox: typeof mapboxgl, container: HTMLDivElement) {
  const initialMarks = useCountriesStore.getState().marks;
  const initialSelectedCode = useSelectedCountryStore.getState().selectedCode;

  return cameraHandoff.mountFromLastCamera(
    (camera) =>
      new mapbox.Map({
        container,
        accessToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
        style: buildMapStyle(initialMarks, initialSelectedCode),
        localFontFamily: getComputedStyle(container).fontFamily,
        projection: "globe",
        center: camera.center,
        zoom: camera.zoom,
        minZoom: 1,
        maxZoom: 8,
      }),
    {
      initialMarks,
      frames: window,
      prefersReducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      bindMapEvents: bindCountryEvents,
    },
  );
}
