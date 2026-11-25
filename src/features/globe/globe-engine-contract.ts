import type { GlobeStores } from "@/features/globe/globe-stores";

export type RunningGlobe = {
  readonly pause: () => void;
  readonly resume: () => void;
  readonly zoomIn: () => void;
  readonly zoomOut: () => void;
};

export type GlobeEngine = {
  readonly start: (container: HTMLElement, stores: GlobeStores) => Promise<RunningGlobe>;
};

type GlobeEngineRegistry = { travizGlobeEngine?: GlobeEngine };

export const GLOBE_ENGINE_EVENT = "traviz:globe-engine";

declare global {
  interface Window extends GlobeEngineRegistry {}
}
