import type { GlobeStores } from "@/features/globe/globe-stores";
import { createGlobeSpin } from "@/features/globe/map-spin";
import type { FrameScheduler, SpinnableMap } from "@/features/globe/map-spin";
import { bindCountryClicks, bindStoreSync } from "@/features/globe/map-store-sync";
import type { SyncedMap } from "@/features/globe/map-store-sync";

type GlobeMap = SpinnableMap &
  SyncedMap & { jumpTo: (options: { center: [number, number]; zoom?: number }) => void };

type GlobeOptions = {
  frames: FrameScheduler;
  stores: GlobeStores;
  prefersReducedMotion: boolean;
};

const DEFAULT_CENTER: [number, number] = [0, 20];
const DEFAULT_ZOOM = 1.4;

export const DEFAULT_CAMERA = { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM };

export function startGlobe(map: GlobeMap, { frames, stores, prefersReducedMotion }: GlobeOptions) {
  const spin = createGlobeSpin(map, { startsStopped: prefersReducedMotion, frames });
  let unbindStores: (() => void) | null = null;

  spin.stopOnUserInteraction();
  bindCountryClicks(map, stores.selection);

  function resume() {
    if (unbindStores !== null) return;

    spin.start();
    unbindStores = bindStoreSync(map, stores, spin.stop);
  }

  function pause() {
    unbindStores?.();
    unbindStores = null;
    spin.pause();
  }

  stores.marks.subscribe((state, previousState) => {
    if (previousState.ownerId === null || state.ownerId === previousState.ownerId) return;

    stores.selection.getState().clearSelection();
    map.jumpTo({ center: [DEFAULT_CENTER[0], DEFAULT_CENTER[1]], zoom: DEFAULT_ZOOM });

    if (prefersReducedMotion) return;

    spin.allowSpin();

    if (unbindStores !== null) spin.start();
  });

  resume();

  return { pause, resume, isSpinning: () => !spin.isStopped() };
}
