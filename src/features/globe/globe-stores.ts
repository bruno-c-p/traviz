import type { SelectionStore } from "@/features/globe/selected-country";
import type { MarksStore } from "@/features/marks";

export type { SelectionStore };

export type GlobeStores = {
  readonly marks: Pick<MarksStore, "getState" | "subscribe">;
  readonly selection: SelectionStore;
  readonly subscribeTheme: (listener: () => void) => () => void;
};
