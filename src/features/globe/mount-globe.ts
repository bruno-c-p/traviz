import type mapboxgl from "mapbox-gl";
import { bindCountryEvents } from "@/features/globe/map-country-events";
import { createGlobeSpin } from "@/features/globe/map-spin";
import { bindStoreSync } from "@/features/globe/map-store-sync";
import { buildMapStyle } from "@/features/globe/map-style";
import { useCountriesStore } from "@/features/marks";
import { useSelectedCountryStore } from "@/features/globe/selected-country";

export function mountGlobe(
  mapbox: typeof mapboxgl,
  container: HTMLDivElement,
  isSpinAllowed: () => boolean,
) {
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

  const spin = createGlobeSpin(map, isSpinAllowed);
  let unsubscribeStores: (() => void) | undefined;

  spin.stopOnUserInteraction();

  map.on("style.load", () => {
    bindCountryEvents(map);
    spin.start();
    unsubscribeStores = bindStoreSync(map, initialMarks, spin.stop);
  });

  function unmount() {
    spin.stop();
    unsubscribeStores?.();
    map.remove();
  }

  return { map, unmount };
}
