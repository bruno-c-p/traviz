import type { MountedView } from "@/shared/view";

export function mountGlobeView(host: HTMLElement): MountedView {
  const globeHost = host.querySelector<HTMLElement>("[data-globe-host]");

  return {
    showView: () => {
      globeHost?.setAttribute("data-globe-shown", "true");
    },
    hideView: () => {
      globeHost?.setAttribute("data-globe-shown", "false");
    },
  };
}
