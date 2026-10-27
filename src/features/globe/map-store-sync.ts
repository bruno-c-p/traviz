import { countryCenter } from "@/features/countries";
import type { Marks } from "@/features/marks";
import { useCountriesStore } from "@/features/marks";
import { useSelectedCountryStore } from "@/features/globe/selected-country";

const FLY_TO_ZOOM = 3;

export interface SyncedMap {
  setMarks(marks: Marks): void;
  setSelectedCode(code: string | null): void;
  onCountryClick(listener: (code: string) => void): void;
  flyTo(options: { center: [number, number]; zoom: number }): void;
  getZoom(): number;
}

function bindMarksSync(map: SyncedMap) {
  map.setMarks(useCountriesStore.getState().marks);

  return useCountriesStore.subscribe((state, previousState) => {
    if (state.marks !== previousState.marks) map.setMarks(state.marks);
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
  map.setSelectedCode(useSelectedCountryStore.getState().selectedCode);
  flyToPendingCountry(map, stopSpin);

  return useSelectedCountryStore.subscribe((state, previousState) => {
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

  map.onCountryClick((code) => useSelectedCountryStore.getState().select(code));

  return () => {
    unsubscribeMarks();
    unsubscribeSelection();
  };
}
