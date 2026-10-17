import type { ExpressionSpecification, FilterSpecification } from "mapbox-gl";
import { countryCenter } from "@/features/countries";
import type { Marks } from "@/features/marks";
import {
  FILL_LAYER_ID,
  SELECTED_LAYER_ID,
  buildFillColorExpression,
  buildSelectedFilter,
} from "@/features/globe/map-style";
import { useCountriesStore } from "@/features/marks";
import { useSelectedCountryStore } from "@/features/globe/selected-country";

const FLY_TO_ZOOM = 3;

export interface SyncedMap {
  setPaintProperty(
    layerId: string,
    name: "fill-color",
    value: ExpressionSpecification | string,
  ): void;
  setFilter(layerId: string, filter: FilterSpecification): void;
  flyTo(options: { center: [number, number]; zoom: number }): void;
  getZoom(): number;
}

function bindMarksSync(map: SyncedMap, initialMarks: Marks) {
  const currentMarks = useCountriesStore.getState().marks;

  if (currentMarks !== initialMarks) {
    map.setPaintProperty(FILL_LAYER_ID, "fill-color", buildFillColorExpression(currentMarks));
  }

  return useCountriesStore.subscribe((state) => {
    map.setPaintProperty(FILL_LAYER_ID, "fill-color", buildFillColorExpression(state.marks));
  });
}

function flyToPendingCountry(map: SyncedMap, stopSpin: () => void) {
  const code = useSelectedCountryStore.getState().takePendingFly();
  const center = code ? countryCenter(code) : null;

  if (center) {
    stopSpin();
    map.flyTo({ center, zoom: Math.max(map.getZoom(), FLY_TO_ZOOM) });
  }
}

function bindSelectionSync(map: SyncedMap, stopSpin: () => void) {
  map.setFilter(
    SELECTED_LAYER_ID,
    buildSelectedFilter(useSelectedCountryStore.getState().selectedCode),
  );
  flyToPendingCountry(map, stopSpin);

  return useSelectedCountryStore.subscribe((state, previousState) => {
    if (state.selectedCode !== previousState.selectedCode) {
      map.setFilter(SELECTED_LAYER_ID, buildSelectedFilter(state.selectedCode));

      if (state.selectedCode) stopSpin();
    }

    if (state.pendingFlyCode) flyToPendingCountry(map, stopSpin);
  });
}

export function bindStoreSync(map: SyncedMap, initialMarks: Marks, stopSpin: () => void) {
  const unsubscribeMarks = bindMarksSync(map, initialMarks);
  const unsubscribeSelection = bindSelectionSync(map, stopSpin);

  return () => {
    unsubscribeMarks();
    unsubscribeSelection();
  };
}
