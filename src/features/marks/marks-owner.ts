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
  type SyncProblem,
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
  readonly previewCache: (isSignedInAs: (ownerId: string) => boolean) => void;
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
  let serverSnapshotRead = 0;
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

  const takeSnapshotRead = () => {
    const read = nextSnapshotRead;
    nextSnapshotRead += 1;

    return read;
  };

  const acceptSnapshot = (snapshot: MarksSnapshot, read: number) => {
    if (read < newestSnapshotRead) return;

    if (snapshot.ok) newestSnapshotRead = read;

    handle({ type: "snapshot-received", snapshot });
  };

  const readFreshSnapshot = (ownerId: string) => {
    const readSession = session;
    const read = takeSnapshotRead();

    try {
      transport.readMarks(ownerId).then(
        (snapshot) => {
          if (readSession === session) acceptSnapshot(snapshot, read);
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
    deadlineProblem: SyncProblem,
  ) => {
    if (sentSession !== session) return;

    if (result.ok) handle({ type: "late-change-confirmed", change, problem: deadlineProblem });

    readFreshSnapshot(ownerId);
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
    let deadlineProblem: SyncProblem | undefined;

    const settle = (result: MarkChangeResult) =>
      handle({ type: "change-settled", id: entry.id, result });

    startDeadline(() => {
      settle(UNAVAILABLE);
      deadlineProblem = state.problems.find(
        (problem) => problem.scope === changeScope(entry.change),
      );
    });

    void applyMarkChange(ownerId, entry.change).then((result) => {
      requestInFlight = false;
      settle(result);

      if (deadlineProblem !== undefined) {
        settleLateReply(ownerId, sentSession, entry.change, result, deadlineProblem);
      }
    });
  };

  const handle = (event: MarksSyncEvent) => {
    dispatch(event);
    sendOldestUnsaved();
  };

  return {
    getState: () => state,
    previewCache: (isSignedInAs) => {
      const cached = readCache();

      if (cached !== null && isSignedInAs(cached.ownerId)) {
        dispatch({ type: "cache-previewed", cached });
      }
    },
    startSession: (ownerId) => {
      if (state.ownerId !== ownerId) beginSession();

      serverSnapshotRead = takeSnapshotRead();
      handle({ type: "session-started", ownerId, cached: readCache() });
    },
    endSession: () => {
      beginSession();
      clearCache();
      handle({ type: "session-ended" });
    },
    receiveSnapshot: (snapshot) => {
      acceptSnapshot(snapshot, serverSnapshotRead);
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
