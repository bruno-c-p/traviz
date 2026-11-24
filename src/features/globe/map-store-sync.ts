import { countryCenter } from "@/features/countries";
import type { Marks } from "@/features/marks";
import { marksStore } from "@/features/marks";
import { selectedCountryStore } from "@/features/globe/selected-country";

const FLY_TO_ZOOM = 3;

export interface SyncedMap {
  setMarks(marks: Marks): void;
  setSelectedCode(code: string | null): void;
  onCountryClick(listener: (code: string) => void): void;
  flyTo(options: { center: [number, number]; zoom: number }): void;
  getZoom(): number;
}

function bindMarksSync(map: SyncedMap) {
  map.setMarks(marksStore.getState().marks);

  return marksStore.subscribe((state, previousState) => {
    if (state.marks !== previousState.marks) map.setMarks(state.marks);
  });
}

function flyToPendingCountry(map: SyncedMap, stopSpin: () => void) {
  const code = selectedCountryStore.getState().takePendingFly();
  const center = code ? countryCenter(code) : null;

  if (center) {
    stopSpin();
    map.flyTo({ center, zoom: Math.max(map.getZoom(), FLY_TO_ZOOM) });
  }
}

function bindSelectionSync(map: SyncedMap, stopSpin: () => void) {
  map.setSelectedCode(selectedCountryStore.getState().selectedCode);
  flyToPendingCountry(map, stopSpin);

  return selectedCountryStore.subscribe((state, previousState) => {
    if (state.selectedCode !== previousState.selectedCode) {
      map.setSelectedCode(state.selectedCode);

      if (state.selectedCode) stopSpin();
    }

    if (state.pendingFlyCode) flyToPendingCountry(map, stopSpin);
  });
}

export function bindStoreSync(map: SyncedMap, stopSpin: () => void) {
  const unsubscribeMarks = bindMarksSync(map);
  const unsubscribeSelection = bindSelectionSync(map, stopSpin);

  map.onCountryClick((code) => selectedCountryStore.getState().select(code));

  return () => {
    unsubscribeMarks();
    unsubscribeSelection();
  };
}
