import type { createGlobe } from "@/features/globe/create-globe";
import { createGlobeSpin } from "@/features/globe/map-spin";
import type { FrameScheduler, SpinnableMap } from "@/features/globe/map-spin";
import { bindStoreSync } from "@/features/globe/map-store-sync";
import type { SyncedMap } from "@/features/globe/map-store-sync";
import type { CountryTopology } from "@/features/globe/globe-scene";
import { useCountriesStore } from "@/features/marks";
import { useSelectedCountryStore } from "@/features/globe/selected-country";

type GlobeMap = SpinnableMap & SyncedMap & { remove: () => void };

export type GlobeCamera = { center: [number, number]; zoom: number; isSpinning: boolean };

type GlobeOptions = { frames: FrameScheduler; isSpinning: boolean };

export function startGlobe(map: GlobeMap, { frames, isSpinning }: GlobeOptions) {
  const spin = createGlobeSpin(map, { startsStopped: !isSpinning, frames });

  spin.stopOnUserInteraction();
  spin.start();

  const unsubscribeStores = bindStoreSync(map, spin.stop);

  return function unmount(): GlobeCamera {
    const { lng, lat } = map.getCenter();

    const camera: GlobeCamera = {
      center: [lng, lat],
      zoom: map.getZoom(),
      isSpinning: !spin.isStopped(),
    };

    spin.stop();
    unsubscribeStores();
    map.remove();

    return camera;
  };
}

type HandoffOptions = Omit<GlobeOptions, "isSpinning"> & { prefersReducedMotion: boolean };

const DEFAULT_CAMERA: GlobeCamera = { center: [0, 20], zoom: 1.4, isSpinning: true };

export function createCameraHandoff() {
  let lastCamera = DEFAULT_CAMERA;
  let resetCount = 0;

  function mountFromLastCamera<T extends GlobeMap>(
    createMap: (camera: GlobeCamera) => T,
    { prefersReducedMotion, ...options }: HandoffOptions,
  ) {
    const resetCountAtMount = resetCount;
    const map = createMap(lastCamera);

    const unmountGlobe = startGlobe(map, {
      ...options,
      isSpinning: lastCamera.isSpinning && !prefersReducedMotion,
    });

    function unmount() {
      const camera = unmountGlobe();

      if (resetCount === resetCountAtMount) lastCamera = camera;
    }

    return { map, unmount };
  }

  return {
    mountFromLastCamera,
    reset: () => {
      lastCamera = DEFAULT_CAMERA;
      resetCount++;
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

type GlobeModules = { createGlobe: typeof createGlobe; topology: CountryTopology };

export function mountGlobe({ createGlobe, topology }: GlobeModules, container: HTMLDivElement) {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return cameraHandoff.mountFromLastCamera(
    ({ center, zoom }) =>
      createGlobe(container, topology, { camera: { center, zoom }, prefersReducedMotion }),
    { frames: window, prefersReducedMotion },
  );
}
