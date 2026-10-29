import type { Camera, LngLat } from "@/features/globe/globe-camera";
import { createGlobeSpin } from "@/features/globe/map-spin";
import type { FrameScheduler, SpinnableMap } from "@/features/globe/map-spin";

const RESUME_SPIN_MS = 4000;
const MAX_FOCUS_LATITUDE = 50;

type PreviewMap = SpinnableMap & {
  getZoom: () => number;
  flyTo: (camera: Camera) => void;
  remove: () => void;
};

type Timers = {
  setTimeout: (callback: () => void, delayMs: number) => number;
  clearTimeout: (timerId: number) => void;
};

type PreviewOptions = { frames: FrameScheduler; timers: Timers; prefersReducedMotion: boolean };

export function startPreviewGlobe(
  map: PreviewMap,
  { frames, timers, prefersReducedMotion }: PreviewOptions,
) {
  let spin = createGlobeSpin(map, { startsStopped: prefersReducedMotion, frames });
  let resumeTimerId: number | null = null;

  function cancelResume() {
    if (resumeTimerId !== null) timers.clearTimeout(resumeTimerId);

    resumeTimerId = null;
  }

  function resumeSpin() {
    resumeTimerId = null;
    spin = createGlobeSpin(map, { startsStopped: false, frames });
    spin.start();
  }

  spin.start();

  return {
    focus: ([longitude, latitude]: LngLat) => {
      spin.stop();
      cancelResume();
      map.flyTo({
        center: [longitude, Math.min(Math.max(latitude, -MAX_FOCUS_LATITUDE), MAX_FOCUS_LATITUDE)],
        zoom: map.getZoom(),
      });

      if (!prefersReducedMotion) resumeTimerId = timers.setTimeout(resumeSpin, RESUME_SPIN_MS);
    },
    stop: () => {
      spin.stop();
      cancelResume();
      map.remove();
    },
  };
}
