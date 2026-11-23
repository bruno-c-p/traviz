import type { LngLat } from "@/features/globe/globe-camera";
import type { GlobeModules } from "@/features/globe/load-globe";
import { startPreviewGlobe } from "@/features/globe/preview-globe-driver";
import { countryCenter } from "@/features/countries/core";
import type { Marks } from "@/features/marks";

type PreviewOptions = { initialCenter: LngLat; marks: Marks };

export function mountPreviewGlobe(
  container: HTMLElement,
  { createGlobe, topology }: GlobeModules,
  { initialCenter, marks }: PreviewOptions,
) {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const globe = createGlobe(container, topology, {
    camera: { center: initialCenter, zoom: 1 },
    prefersReducedMotion,
    isInteractive: false,
  });

  const driver = startPreviewGlobe(globe, { frames: window, timers: window, prefersReducedMotion });

  globe.setMarks(marks);

  return {
    setMarks: globe.setMarks,
    focus: (code: string) => {
      const center = countryCenter(code);

      if (center) driver.focus(center);
    },
    stop: driver.stop,
  };
}
