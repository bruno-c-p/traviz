import { describe, expect, test } from "bun:test";
import type { CountryState, Marks } from "@/features/marks/colors";
import {
  applyChange,
  INITIAL_MARKS_SYNC_STATE,
  reduceMarksSync,
  snapshotFromMarks,
  visibleMarks,
  type CachedMarks,
  type MarkChangeFailure,
  type MarksSyncEvent,
  type MarksSyncState,
} from "@/features/marks/marks-sync";

const OWNER = "user_a";
const OTHER_OWNER = "user_b";

const started = (ownerId: string, cached: CachedMarks | null = null): MarksSyncEvent => ({
  type: "session-started",
  ownerId,
  cached,
});

const ended = (): MarksSyncEvent => ({ type: "session-ended" });

const snapshot = (marks: Marks, ownerId = OWNER): MarksSyncEvent => ({
  type: "snapshot-received",
  snapshot: { ok: true, ownerId, marks },
});

const failedSnapshot = (): MarksSyncEvent => ({
  type: "snapshot-received",
  snapshot: { ok: false, ownerId: OWNER },
});

const setMark = (code: string, state: CountryState): MarksSyncEvent => ({
  type: "change-requested",
  change: { kind: "set", code, state },
});

const clearMark = (code: string): MarksSyncEvent => ({
  type: "change-requested",
  change: { kind: "clear", code },
});

const reset = (): MarksSyncEvent => ({ type: "change-requested", change: { kind: "reset" } });
const sent = (id: number): MarksSyncEvent => ({ type: "change-sent", id });

const saved = (id: number): MarksSyncEvent => ({
  type: "change-settled",
  id,
  result: { ok: true },
});

const failed = (id: number, reason: MarkChangeFailure): MarksSyncEvent => ({
  type: "change-settled",
  id,
  result: { ok: false, reason },
});

const play = (events: readonly MarksSyncEvent[], from: MarksSyncState = INITIAL_MARKS_SYNC_STATE) =>
  events.reduce(reduceMarksSync, from);

describe("R-9, appeared and fixed inside 0a897af before commit", () => {
  test("a tap made during the sync window survives the server snapshot", () => {
    const state = play([started(OWNER), setMark("DEU", "visited"), snapshot({ FRA: "want" })]);

    expect(visibleMarks(state)).toEqual({ FRA: "want", DEU: "visited" });
  });

  test("a tap in flight survives a second server snapshot", () => {
    const state = play([
      started(OWNER),
      snapshot({ FRA: "want" }),
      setMark("DEU", "visited"),
      sent(1),
      snapshot({ FRA: "want" }),
    ]);

    expect(visibleMarks(state)).toEqual({ FRA: "want", DEU: "visited" });
    expect(state.pending.map((entry) => entry.phase)).toEqual(["sending"]);
  });
});

describe("F16.1, appeared in 0a897af, fixed in 6d38bf7", () => {
  test("a reset saved before the first sync survives a stale snapshot", () => {
    const state = play([
      started(OWNER, { ownerId: OWNER, marks: { FRA: "visited" } }),
      reset(),
      sent(1),
      saved(1),
      snapshot({ FRA: "visited" }),
    ]);

    expect(visibleMarks(state)).toEqual({});
  });
});

describe("F16.3, appeared in 0a897af, fixed in 6d38bf7", () => {
  test("a pre-sync edit the server rejected is not replayed", () => {
    const state = play([
      started(OWNER),
      setMark("FRA", "visited"),
      sent(1),
      failed(1, "rejected"),
      snapshot({}),
    ]);

    expect(visibleMarks(state)).toEqual({});
  });
});

describe("M3, appeared in 81cc227 (PR #5), open on main in scheduleWrite", () => {
  test("a failed write after sync rolls back and leaves a per-country problem", () => {
    const state = play([
      started(OWNER),
      snapshot({}),
      setMark("FRA", "visited"),
      sent(1),
      failed(1, "unavailable"),
    ]);

    expect(visibleMarks(state)).toEqual({});
    expect(state.problems).toEqual([{ scope: "FRA", reason: "unavailable" }]);
  });
});

describe("F5.1, appeared in 81cc227 (PR #5), open on main in scheduleWrite", () => {
  test("one country's success keeps another country's problem", () => {
    const state = play([
      started(OWNER),
      snapshot({}),
      setMark("DEU", "visited"),
      sent(1),
      failed(1, "unavailable"),
      setMark("FRA", "visited"),
      sent(2),
      saved(2),
    ]);

    expect(state.problems).toEqual([{ scope: "DEU", reason: "unavailable" }]);
    expect(visibleMarks(state)).toEqual({ FRA: "visited" });
  });
});

describe("marks sync", () => {
  test("applyChange sets, clears and resets marks without touching the input", () => {
    const marks: Marks = { FRA: "visited", DEU: "want" };

    expect(applyChange(marks, { kind: "set", code: "BRA", state: "not_interested" })).toEqual({
      FRA: "visited",
      DEU: "want",
      BRA: "not_interested",
    });
    expect(applyChange(marks, { kind: "clear", code: "FRA" })).toEqual({ DEU: "want" });
    expect(applyChange(marks, { kind: "reset" })).toEqual({});
    expect(marks).toEqual({ FRA: "visited", DEU: "want" });
  });

  test("a session shows its own owner's cached marks before the snapshot", () => {
    const state = play([started(OWNER, { ownerId: OWNER, marks: { FRA: "visited" } })]);

    expect(visibleMarks(state)).toEqual({ FRA: "visited" });
  });

  test("a session ignores another owner's cached marks", () => {
    const state = play([started(OWNER, { ownerId: OTHER_OWNER, marks: { FRA: "visited" } })]);

    expect(visibleMarks(state)).toEqual({});
  });

  test("a session for another owner drops the previous owner's queued changes", () => {
    const state = play([started(OWNER), setMark("FRA", "visited"), started(OTHER_OWNER)]);

    expect(state.pending).toEqual([]);
    expect(visibleMarks(state)).toEqual({});
  });

  test("a session keeps changes queued before any owner was known", () => {
    const state = play([setMark("FRA", "visited"), started(OWNER)]);

    expect(visibleMarks(state)).toEqual({ FRA: "visited" });
  });

  test("restarting the same owner's session keeps the synced marks", () => {
    const synced = play([started(OWNER), snapshot({ FRA: "visited" })]);

    expect(reduceMarksSync(synced, started(OWNER))).toBe(synced);
  });

  test("a settle for a change from an ended session is ignored", () => {
    const beforeEnd = play([started(OWNER), snapshot({}), setMark("FRA", "visited"), sent(1)]);

    const queued = play([ended(), started(OWNER), snapshot({}), setMark("DEU", "want")], beforeEnd);

    const nextSession = play([sent(queued.lastChangeId)], queued);
    const state = play([failed(1, "unavailable")], nextSession);

    expect(state).toBe(nextSession);
    expect(visibleMarks(state)).toEqual({ DEU: "want" });
    expect(state.problems).toEqual([]);
  });

  test("a repeated snapshot keeps unsent and in-flight changes", () => {
    const state = play([
      started(OWNER),
      snapshot({}),
      setMark("FRA", "visited"),
      clearMark("DEU"),
      sent(1),
      snapshot({ DEU: "want", ITA: "want" }),
    ]);

    expect(visibleMarks(state)).toEqual({ FRA: "visited", ITA: "want" });
  });

  test("a snapshot for another owner is ignored", () => {
    const waiting = play([started(OWNER), setMark("FRA", "visited")]);

    expect(reduceMarksSync(waiting, snapshot({ DEU: "want" }, OTHER_OWNER))).toBe(waiting);
  });

  test("a failed snapshot keeps the cached marks and records a problem until one lands", () => {
    const failing = play([
      started(OWNER, { ownerId: OWNER, marks: { FRA: "visited" } }),
      failedSnapshot(),
    ]);

    expect(visibleMarks(failing)).toEqual({ FRA: "visited" });
    expect(failing.problems).toEqual([{ scope: "snapshot", reason: "unavailable" }]);

    const recovered = play([snapshot({ DEU: "want" })], failing);

    expect(visibleMarks(recovered)).toEqual({ DEU: "want" });
    expect(recovered.problems).toEqual([]);
  });

  test("a failed reset records one all-marks problem and a later success clears it", () => {
    const failing = play([
      started(OWNER),
      snapshot({ FRA: "visited" }),
      reset(),
      sent(1),
      failed(1, "rejected"),
      reset(),
      sent(2),
      failed(2, "unavailable"),
    ]);

    expect(visibleMarks(failing)).toEqual({ FRA: "visited" });
    expect(failing.problems).toEqual([{ scope: "all-marks", reason: "unavailable" }]);

    const recovered = play([reset(), sent(3), saved(3)], failing);

    expect(visibleMarks(recovered)).toEqual({});
    expect(recovered.problems).toEqual([]);
  });

  test("change-sent moves a waiting change to sending and ignores unknown ids", () => {
    const waiting = play([started(OWNER), setMark("FRA", "visited")]);
    const sending = reduceMarksSync(waiting, sent(1));

    expect(sending.pending.map((entry) => entry.phase)).toEqual(["sending"]);
    expect(reduceMarksSync(sending, sent(7))).toBe(sending);
  });

  test("two countries that fail keep a problem each", () => {
    const state = play([
      started(OWNER),
      snapshot({}),
      setMark("BRA", "visited"),
      sent(1),
      failed(1, "rejected"),
      setMark("ARG", "visited"),
      sent(2),
      failed(2, "rejected"),
    ]);

    expect(state.problems).toEqual([
      { scope: "BRA", reason: "rejected" },
      { scope: "ARG", reason: "rejected" },
    ]);
  });

  test("a problem keeps the reason the server gave", () => {
    const state = play([
      started(OWNER),
      snapshot({}),
      setMark("BRA", "visited"),
      sent(1),
      failed(1, "signed-out"),
    ]);

    expect(state.problems).toEqual([{ scope: "BRA", reason: "signed-out" }]);
  });

  test("a later snapshot keeps a country's write problem until a save on that country succeeds", () => {
    const state = play([
      started(OWNER),
      snapshot({}),
      setMark("BRA", "visited"),
      sent(1),
      failed(1, "rejected"),
      snapshot({}),
    ]);

    expect(state.problems).toEqual([{ scope: "BRA", reason: "rejected" }]);
  });

  test("a session for another owner drops the previous owner's problems", () => {
    const state = play([
      started(OWNER),
      snapshot({}),
      setMark("BRA", "visited"),
      sent(1),
      failed(1, "rejected"),
      started(OTHER_OWNER),
    ]);

    expect(state.problems).toEqual([]);
  });

  test("a snapshot folds saved changes out of the queue", () => {
    const state = play([
      started(OWNER),
      snapshot({}),
      setMark("BRA", "visited"),
      sent(1),
      saved(1),
      snapshot({ BRA: "visited" }),
    ]);

    expect(state.pending).toEqual([]);
    expect(state.base).toEqual({ source: "server", marks: { BRA: "visited" } });
  });

  test("change-sent moves only the change it names", () => {
    const state = play([
      started(OWNER),
      snapshot({}),
      setMark("BRA", "visited"),
      setMark("ARG", "visited"),
      sent(1),
    ]);

    expect(state.pending.map((entry) => entry.phase)).toEqual(["sending", "waiting"]);
  });

  test("change-sent is ignored while another change is in flight", () => {
    const sending = play([
      started(OWNER),
      snapshot({}),
      setMark("FRA", "visited"),
      setMark("DEU", "want"),
      sent(1),
    ]);

    expect(reduceMarksSync(sending, sent(2))).toBe(sending);
    expect(reduceMarksSync(sending, sent(1))).toBe(sending);
  });

  test("change-sent is ignored for any change but the oldest unsent one", () => {
    const waiting = play([
      started(OWNER),
      snapshot({}),
      setMark("FRA", "visited"),
      reset(),
      setMark("DEU", "want"),
    ]);

    expect(reduceMarksSync(waiting, sent(2))).toBe(waiting);
    expect(reduceMarksSync(waiting, sent(3))).toBe(waiting);

    const afterFirst = play([sent(1), saved(1), sent(2)], waiting);

    expect(afterFirst.pending.map((entry) => entry.phase)).toEqual(["saved", "sending", "waiting"]);
  });

  test("settling the same change twice returns the same state", () => {
    const settled = play([
      started(OWNER),
      snapshot({}),
      setMark("FRA", "visited"),
      sent(1),
      saved(1),
    ]);

    expect(visibleMarks(settled)).toEqual({ FRA: "visited" });
    expect(reduceMarksSync(settled, saved(1))).toBe(settled);
    expect(reduceMarksSync(settled, failed(1, "unavailable"))).toBe(settled);
  });

  test("a late failure for a change the server already saved is ignored", () => {
    const presync = play([started(OWNER), setMark("FRA", "visited"), sent(1), saved(1)]);

    expect(reduceMarksSync(presync, failed(1, "unavailable"))).toBe(presync);
  });

  test("a settle for a change that was never sent is ignored", () => {
    const waiting = play([started(OWNER), snapshot({}), setMark("FRA", "visited")]);

    expect(reduceMarksSync(waiting, saved(1))).toBe(waiting);
  });

  test("a stale snapshot after sync keeps a change the server already saved", () => {
    const state = play([
      started(OWNER),
      snapshot({}),
      setMark("FRA", "visited"),
      sent(1),
      saved(1),
      snapshot({}),
    ]);

    expect(visibleMarks(state)).toEqual({ FRA: "visited" });
  });

  test("the base holds every server-confirmed change and the screen adds the unsaved ones", () => {
    const state = play([
      started(OWNER),
      snapshot({ ITA: "want" }),
      setMark("FRA", "visited"),
      sent(1),
      saved(1),
      reset(),
      sent(2),
      saved(2),
      setMark("DEU", "want"),
      sent(3),
      saved(3),
      setMark("ESP", "visited"),
    ]);

    expect(state.base).toEqual({ source: "server", marks: { DEU: "want" } });
    expect(visibleMarks(state)).toEqual({ DEU: "want", ESP: "visited" });
  });

  test("a change saved before the first snapshot never marks the base as server-confirmed", () => {
    const uncached = play([started(OWNER), setMark("FRA", "visited"), sent(1), saved(1)]);

    const cached = play([
      started(OWNER, { ownerId: OWNER, marks: { ITA: "want" } }),
      setMark("FRA", "visited"),
      sent(1),
      saved(1),
    ]);

    expect(uncached.base).toEqual({ source: "empty" });
    expect(cached.base).toEqual({ source: "cache", marks: { ITA: "want", FRA: "visited" } });
  });

  test("a tap after the session ended is not carried into the next session", () => {
    const state = play([
      started(OWNER),
      snapshot({ FRA: "visited" }),
      ended(),
      setMark("DEU", "want"),
      started(OTHER_OWNER),
    ]);

    expect(state.pending).toEqual([]);
    expect(visibleMarks(state)).toEqual({});
  });
});

describe("problems after unit 21", () => {
  test("dismissing a problem removes only that scope", () => {
    const state = play([
      started(OWNER),
      snapshot({}),
      setMark("DEU", "visited"),
      sent(1),
      failed(1, "unavailable"),
      setMark("FRA", "want"),
      sent(2),
      failed(2, "rejected"),
      { type: "problem-dismissed", scope: "DEU" },
    ]);

    expect(state.problems).toEqual([{ scope: "FRA", reason: "rejected" }]);
  });

  test("a saved reset clears every change problem and keeps the snapshot problem", () => {
    const state = play([
      started(OWNER),
      failedSnapshot(),
      setMark("DEU", "visited"),
      sent(1),
      failed(1, "unavailable"),
      reset(),
      sent(2),
      failed(2, "unavailable"),
      reset(),
      sent(3),
      saved(3),
    ]);

    expect(state.problems).toEqual([{ scope: "snapshot", reason: "unavailable" }]);
  });

  test("a failed reset keeps the earlier change problems", () => {
    const state = play([
      started(OWNER),
      snapshot({}),
      setMark("DEU", "visited"),
      sent(1),
      failed(1, "unavailable"),
      reset(),
      sent(2),
      failed(2, "unavailable"),
    ]);

    expect(state.problems).toEqual([
      { scope: "DEU", reason: "unavailable" },
      { scope: "all-marks", reason: "unavailable" },
    ]);
  });
});

describe("the snapshot from the server render", () => {
  test("loaded marks become an ok snapshot for that owner", async () => {
    expect(await snapshotFromMarks(OWNER, Promise.resolve({ DEU: "visited" }))).toEqual({
      ok: true,
      ownerId: OWNER,
      marks: { DEU: "visited" },
    });
  });

  test("marks that failed to load become a failed snapshot for that owner", async () => {
    expect(await snapshotFromMarks(OWNER, Promise.reject(new Error("hanging promise")))).toEqual({
      ok: false,
      ownerId: OWNER,
    });
  });
});
