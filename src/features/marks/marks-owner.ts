import {
  changeScope,
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
  readonly readMarks: (expectedOwnerId: string) => Promise<MarksSnapshot>;
};

export type MarksCache = {
  readonly read: () => CachedMarks | null;
  readonly write: (cached: CachedMarks) => void;
  readonly clear: () => void;
};

export type MarksDeadline = (onExpired: () => void) => void;

export type MarksOwner = {
  readonly getState: () => MarksSyncState;
  readonly startSession: (ownerId: string) => void;
  readonly endSession: () => void;
  readonly receiveSnapshot: (snapshot: MarksSnapshot) => void;
  readonly requestChange: (change: MarkChange) => void;
  readonly dismissProblem: (scope: string) => void;
  readonly subscribe: (listener: () => void) => () => void;
};

const UNAVAILABLE: MarkChangeResult = { ok: false, reason: "unavailable" };

export function createMarksOwner(
  transport: MarksTransport,
  cache: MarksCache,
  startDeadline: MarksDeadline,
): MarksOwner {
  let state = INITIAL_MARKS_SYNC_STATE;
  let requestInFlight = false;
  let session = 0;
  let nextSnapshotRead = 1;
  let newestSnapshotRead = 0;
  const listeners = new Set<() => void>();

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
    } catch {}
  };

  const clearCache = () => {
    try {
      cache.clear();
    } catch {}
  };

  const dispatch = (event: MarksSyncEvent) => {
    const previous = state;
    state = reduceMarksSync(state, event);

    if (state === previous) return;

    writeCache(previous);
    listeners.forEach((listener) => listener());
  };

  const beginSession = () => {
    session += 1;
    nextSnapshotRead = 1;
    newestSnapshotRead = 0;
  };

  const acceptSnapshot = (snapshot: MarksSnapshot, read: number): boolean => {
    if (read < newestSnapshotRead) return false;

    if (snapshot.ok) newestSnapshotRead = read;

    handle({ type: "snapshot-received", snapshot });

    return snapshot.ok;
  };

  const readFreshSnapshot = (ownerId: string, onAccepted: () => void) => {
    const readSession = session;
    const read = nextSnapshotRead;
    nextSnapshotRead += 1;

    try {
      transport.readMarks(ownerId).then(
        (snapshot) => {
          if (readSession === session && acceptSnapshot(snapshot, read)) onAccepted();
        },
        () => {},
      );
    } catch {}
  };

  const settleLateReply = (
    ownerId: string,
    sentSession: number,
    change: MarkChange,
    result: MarkChangeResult,
  ) => {
    if (sentSession !== session) return;

    readFreshSnapshot(ownerId, () => {
      if (result.ok) handle({ type: "problem-dismissed", scope: changeScope(change) });
    });
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

    const sentSession = session;
    let expired = false;

    const settle = (result: MarkChangeResult) =>
      handle({ type: "change-settled", id: entry.id, result });

    startDeadline(() => {
      expired = true;
      settle(UNAVAILABLE);
    });

    void applyMarkChange(ownerId, entry.change).then((result) => {
      requestInFlight = false;
      settle(result);

      if (expired) settleLateReply(ownerId, sentSession, entry.change, result);
    });
  };

  const handle = (event: MarksSyncEvent) => {
    dispatch(event);
    sendOldestUnsaved();
  };

  return {
    getState: () => state,
    startSession: (ownerId) => {
      if (state.ownerId !== ownerId) beginSession();

      handle({ type: "session-started", ownerId, cached: readCache() });
    },
    endSession: () => {
      beginSession();
      clearCache();
      handle({ type: "session-ended" });
    },
    receiveSnapshot: (snapshot) => {
      acceptSnapshot(snapshot, 0);
    },
    requestChange: (change) => handle({ type: "change-requested", change }),
    dismissProblem: (scope) => handle({ type: "problem-dismissed", scope }),
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
}
