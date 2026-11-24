import { COUNTRY_TOPOLOGY } from "@/features/globe/country-topology.generated";
import { createGlobe } from "@/features/globe/create-globe";
import { GLOBE_ENGINE_EVENT } from "@/features/globe/globe-engine-contract";
import type { GlobeEngine, RunningGlobe } from "@/features/globe/globe-engine-contract";
import type { GlobeStores } from "@/features/globe/globe-stores";
import { DEFAULT_CAMERA, startGlobe } from "@/features/globe/mount-globe";

function afterNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => setTimeout(resolve, 0));
  });
}

async function start(container: HTMLElement, stores: GlobeStores): Promise<RunningGlobe> {
  await afterNextPaint();

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const map = createGlobe(container, COUNTRY_TOPOLOGY, {
    camera: DEFAULT_CAMERA,
    prefersReducedMotion,
  });

  const globe = startGlobe(map, { frames: window, stores, prefersReducedMotion });

  return { pause: globe.pause, resume: globe.resume, zoomIn: map.zoomIn, zoomOut: map.zoomOut };
}

export function registerGlobeEngine() {
  const engine: GlobeEngine = { start };

  window.travizGlobeEngine = engine;
  document.dispatchEvent(new Event(GLOBE_ENGINE_EVENT));
}
