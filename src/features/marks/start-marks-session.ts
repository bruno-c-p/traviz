import type { MarksStore } from "@/features/marks/marks-store";
import { decodeMarksSnapshot } from "@/features/marks/marks-wire";

export const MARKS_SNAPSHOT_ID = "marks-snapshot";

export function startMarksSession(store: MarksStore, snapshotText: string | null | undefined) {
  const snapshot = decodeMarksSnapshot(snapshotText ?? "");

  if (snapshot === null) return;

  store.getState().startSession(snapshot.ownerId);
  store.getState().receiveSnapshot(snapshot);
}
