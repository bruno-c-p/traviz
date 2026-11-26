import { placeCenter } from "@/features/globe/globe-places";
import type { Marks } from "@/features/marks";
import type { GlobeStores, SelectionStore } from "@/features/globe/globe-stores";

const FLY_TO_ZOOM = 3;

export interface SyncedMap {
  setMarks(marks: Marks): void;
  setSelectedCode(code: string | null): void;
  onCountryClick(listener: (code: string) => void): void;
  flyTo(options: { center: [number, number]; zoom: number }): void;
  getZoom(): number;
}

function bindMarksSync(map: SyncedMap, marks: GlobeStores["marks"]) {
  map.setMarks(marks.getState().marks);

  return marks.subscribe((state, previousState) => {
    if (state.marks !== previousState.marks) map.setMarks(state.marks);
  });
}

function flyToPendingCountry(map: SyncedMap, selection: SelectionStore, stopSpin: () => void) {
  const code = selection.getState().takePendingFly();
  const center = code ? placeCenter(code) : null;

  if (center) {
    stopSpin();
    map.flyTo({ center, zoom: Math.max(map.getZoom(), FLY_TO_ZOOM) });
  }
}

function bindSelectionSync(map: SyncedMap, selection: SelectionStore, stopSpin: () => void) {
  map.setSelectedCode(selection.getState().selectedCode);
  flyToPendingCountry(map, selection, stopSpin);

  return selection.subscribe((state, previousState) => {
    if (state.selectedCode !== previousState.selectedCode) {
      map.setSelectedCode(state.selectedCode);

      if (state.selectedCode) stopSpin();
    }

    if (state.pendingFlyCode) flyToPendingCountry(map, selection, stopSpin);
  });
}

export function bindCountryClicks(map: SyncedMap, selection: SelectionStore) {
  map.onCountryClick((code) => selection.getState().select(code));
}

export function bindStoreSync(map: SyncedMap, stores: GlobeStores, stopSpin: () => void) {
  const unsubscribeMarks = bindMarksSync(map, stores.marks);
  const unsubscribeSelection = bindSelectionSync(map, stores.selection, stopSpin);

  return () => {
    unsubscribeMarks();
    unsubscribeSelection();
  };
}
