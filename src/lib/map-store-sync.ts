import type { Map as MapboxMap } from "mapbox-gl";
import { countryCenter } from "@/features/countries";
import type { Marks } from "@/lib/colors";
import {
  FILL_LAYER_ID,
  SELECTED_LAYER_ID,
  buildFillColorExpression,
  buildSelectedFilter,
} from "@/lib/mapStyle";
import { useCountriesStore } from "@/store/countries";
import { useSelectedCountryStore } from "@/store/selected-country";

const FLY_TO_ZOOM = 3;

function bindMarksSync(map: MapboxMap, initialMarks: Marks) {
  const currentMarks = useCountriesStore.getState().marks;

  if (currentMarks !== initialMarks) {
    map.setPaintProperty(FILL_LAYER_ID, "fill-color", buildFillColorExpression(currentMarks));
  }

  return useCountriesStore.subscribe((state) => {
    map.setPaintProperty(FILL_LAYER_ID, "fill-color", buildFillColorExpression(state.marks));
  });
}

function bindSelectionSync(map: MapboxMap, stopSpin: () => void) {
  map.setFilter(
    SELECTED_LAYER_ID,
    buildSelectedFilter(useSelectedCountryStore.getState().selectedCode),
  );

  return useSelectedCountryStore.subscribe((state, previousState) => {
    if (state.selectedCode !== previousState.selectedCode) {
      map.setFilter(SELECTED_LAYER_ID, buildSelectedFilter(state.selectedCode));

      if (state.selectedCode) stopSpin();
    }

    if (state.flyRequest && state.flyRequest !== previousState.flyRequest) {
      const center = countryCenter(state.flyRequest.code);

      if (center) {
        stopSpin();
        map.flyTo({ center, zoom: Math.max(map.getZoom(), FLY_TO_ZOOM) });
      }
    }
  });
}

export function bindStoreSync(map: MapboxMap, initialMarks: Marks, stopSpin: () => void) {
  const unsubscribeMarks = bindMarksSync(map, initialMarks);
  const unsubscribeSelection = bindSelectionSync(map, stopSpin);

  return () => {
    unsubscribeMarks();
    unsubscribeSelection();
  };
}
