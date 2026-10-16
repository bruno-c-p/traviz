import {
  INITIAL_MARKS_SYNC_STATE,
  reduceMarksSync,
  type CachedMarks,
  type MarkChange,
  type MarkChangeResult,
  type MarksSnapshot,
  type MarksSyncEvent,
  type MarksSyncState,
} from "@/features/marks/marks-sync";

export type MarksTransport = {
  readonly applyMarkChange: (
    expectedOwnerId: string,
    change: MarkChange,
  ) => Promise<MarkChangeResult>;
};

export type MarksCache = {
  readonly read: () => CachedMarks | null;
  readonly write: (cached: CachedMarks) => void;
};

export type MarksOwner = {
  readonly getState: () => MarksSyncState;
  readonly startSession: (ownerId: string) => void;
  readonly endSession: () => void;
  readonly receiveSnapshot: (snapshot: MarksSnapshot) => void;
  readonly requestChange: (change: MarkChange) => void;
};

const UNAVAILABLE: MarkChangeResult = { ok: false, reason: "unavailable" };

export function createMarksOwner(transport: MarksTransport, cache: MarksCache): MarksOwner {
  let state = INITIAL_MARKS_SYNC_STATE;
  let requestInFlight = false;

  const readCache = (): CachedMarks | null => {
    try {
      return cache.read();
    } catch {
      return null;
    }
  };

  const writeCache = (previous: MarksSyncState) => {
    const { base, ownerId } = state;

    if (base === previous.base || base.source !== "server" || ownerId === null) return;

    try {
      cache.write({ ownerId, marks: base.marks });
    } catch {
      return;
    }
  };

  const dispatch = (event: MarksSyncEvent) => {
    const previous = state;
    state = reduceMarksSync(state, event);
    writeCache(previous);
  };

  const applyMarkChange = (ownerId: string, change: MarkChange): Promise<MarkChangeResult> => {
    try {
      return transport.applyMarkChange(ownerId, change).catch(() => UNAVAILABLE);
    } catch {
      return Promise.resolve(UNAVAILABLE);
    }
  };

  const sendOldestUnsaved = () => {
    const { ownerId } = state;
    const entry = state.pending.find((candidate) => candidate.phase !== "saved");

    if (requestInFlight || ownerId === null || entry === undefined) return;

    requestInFlight = true;
    dispatch({ type: "change-sent", id: entry.id });

    void applyMarkChange(ownerId, entry.change).then((result) => {
      requestInFlight = false;
      handle({ type: "change-settled", id: entry.id, result });
    });
  };

  const handle = (event: MarksSyncEvent) => {
    dispatch(event);
    sendOldestUnsaved();
  };

  return {
    getState: () => state,
    startSession: (ownerId) => handle({ type: "session-started", ownerId, cached: readCache() }),
    endSession: () => handle({ type: "session-ended" }),
    receiveSnapshot: (snapshot) => handle({ type: "snapshot-received", snapshot }),
    requestChange: (change) => handle({ type: "change-requested", change }),
  };
}
