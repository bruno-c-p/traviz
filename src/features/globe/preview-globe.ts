import type { LngLat } from "@/features/globe/globe-camera";
import { loadGlobe } from "@/features/globe/load-globe";
import type { Marks } from "@/features/marks";

type PreviewOptions = { initialCenter: LngLat; marks: () => Marks };

export async function loadPreviewGlobe(container: HTMLElement, options: PreviewOptions) {
  const [globeModules, preview] = await Promise.all([
    loadGlobe(),
    import("@/features/globe/mount-preview-globe"),
  ]);

  if (!globeModules) return null;

  return preview.mountPreviewGlobe(container, globeModules, {
    initialCenter: options.initialCenter,
    marks: options.marks(),
  });
}
