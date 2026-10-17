import { describe, expect, test } from "bun:test";
import type { Marks } from "@/features/marks/colors";
import {
  createMarksOwner,
  type MarksCache,
  type MarksDeadline,
  type MarksTransport,
} from "@/features/marks/marks-owner";
import {
  applyChange,
  visibleMarks,
  type CachedMarks,
  type MarkChange,
  type MarkChangeResult,
} from "@/features/marks/marks-sync";

const OWNER = "user_a";
const OTHER_OWNER = "user_b";

const tapDeu: MarkChange = { kind: "set", code: "DEU", state: "visited" };
const tapFra: MarkChange = { kind: "set", code: "FRA", state: "want" };
const tapIta: MarkChange = { kind: "set", code: "ITA", state: "visited" };
const resetAll: MarkChange = { kind: "reset" };

const SAVED: MarkChangeResult = { ok: true };

type FakeCall = {
  readonly expectedOwnerId: string;
  readonly change: MarkChange;
  readonly resolve: (result: MarkChangeResult) => void;
  readonly reject: (cause: unknown) => void;
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function fakeTransport() {
  const calls: FakeCall[] = [];
  let serverMarks: Marks = {};

  const transport: MarksTransport = {
    applyMarkChange: (expectedOwnerId, change) =>
      new Promise((resolve, reject) => {
        calls.push({ expectedOwnerId, change, resolve, reject });
      }),
    readMarks: () => new Promise(() => {}),
  };

  const sent = () => calls.map((call) => [call.expectedOwnerId, call.change]);

  const answer = async (index: number, result: MarkChangeResult = SAVED) => {
    const call = calls[index];

    if (call === undefined) throw new Error(`no call ${index}`);

    if (result.ok) serverMarks = applyChange(serverMarks, call.change);

    call.resolve(result);

    await flush();
  };

  const fail = async (index: number) => {
    calls[index]?.reject(new Error("network down"));
    await flush();
  };

  return { transport, sent, answer, fail, server: () => serverMarks };
}

type FakeTransport = ReturnType<typeof fakeTransport>;

function fakeCache(
  options: { stored?: CachedMarks; readFails?: boolean; writeFails?: boolean } = {},
) {
  const writes: CachedMarks[] = [];

  const cache: MarksCache = {
    read: () => {
      if (options.readFails === true) throw new Error("storage blocked");

      return options.stored ?? null;
    },
    write: (cached) => {
      if (options.writeFails === true) throw new Error("quota exceeded");
      writes.push(cached);
    },
    clear: () => {},
  };

  return { cache, writes };
}

function fakeDeadline() {
  const expiries: (() => void)[] = [];

  const startDeadline: MarksDeadline = (onExpired) => {
    expiries.push(onExpired);
  };

  const expire = async (index: number) => {
    const onExpired = expiries[index];

    if (onExpired === undefined) throw new Error(`no deadline ${index}`);

    onExpired();

    await flush();
  };

  return { startDeadline, expire };
}

function setup(cacheOptions: Parameters<typeof fakeCache>[0] = {}) {
  const fake = fakeTransport();
  const store = fakeCache(cacheOptions);
  const deadline = fakeDeadline();
  const owner = createMarksOwner(fake.transport, store.cache, deadline.startDeadline);

  return { ...fake, ...store, ...deadline, owner };
}

describe("write, reset, write, appeared in 81cc227, open on main: resetAll calls clearMarksAction outside scheduleWrite's per-country chain", () => {
  test("the reset waits for the earlier tap and the later tap waits for the reset", async () => {
    const { owner, sent, answer, server } = setup();
    owner.startSession(OWNER);
    owner.receiveSnapshot({ ok: true, ownerId: OWNER, marks: {} });

    owner.requestChange(tapDeu);
    owner.requestChange(resetAll);
    owner.requestChange(tapFra);
    await flush();

    expect(sent()).toEqual([[OWNER, tapDeu]]);

    await answer(0);
    expect(sent()).toEqual([
      [OWNER, tapDeu],
      [OWNER, resetAll],
    ]);

    await answer(1);
    await answer(2);
    expect(sent()).toEqual([
      [OWNER, tapDeu],
      [OWNER, resetAll],
      [OWNER, tapFra],
    ]);
    expect(server()).toEqual({ FRA: "want" });
    expect(visibleMarks(owner.getState())).toEqual({ FRA: "want" });
  });

  test("a failed first tap still lets the reset and the later tap go out in order", async () => {
    const { owner, sent, answer, fail, server } = setup();
    owner.startSession(OWNER);
    owner.receiveSnapshot({ ok: true, ownerId: OWNER, marks: {} });

    owner.requestChange(tapDeu);
    owner.requestChange(resetAll);
    owner.requestChange(tapFra);
    await flush();

    await fail(0);
    expect(sent()).toEqual([
      [OWNER, tapDeu],
      [OWNER, resetAll],
    ]);

    await answer(1);
    await answer(2);
    expect(sent()).toEqual([
      [OWNER, tapDeu],
      [OWNER, resetAll],
      [OWNER, tapFra],
    ]);
    expect(server()).toEqual({ FRA: "want" });
  });

  test("a reset after signing back in to the same account waits for the tap still on the wire", async () => {
    const { owner, sent, answer, writes } = setup();
    owner.startSession(OWNER);
    owner.receiveSnapshot({ ok: true, ownerId: OWNER, marks: {} });
    owner.requestChange(tapDeu);
    await flush();

    owner.endSession();
    owner.startSession(OWNER);
    owner.requestChange(resetAll);
    await flush();

    expect(sent()).toEqual([[OWNER, tapDeu]]);

    await answer(0);

    expect(visibleMarks(owner.getState())).toEqual({});
    expect(owner.getState().problems).toEqual([]);
    expect(writes).toEqual([{ ownerId: OWNER, marks: {} }]);
    expect(sent()).toEqual([
      [OWNER, tapDeu],
      [OWNER, resetAll],
    ]);
  });
});

describe("F5.2 and F5.3, appeared in 81cc227 (PR #5), open on main: clearLocal clears pendingWrites but queued writes still run", () => {
  const previousAccountReplies = [
    { kind: "saved", reply: (fake: FakeTransport) => fake.answer(0) },
    {
      kind: "refused",
      reply: (fake: FakeTransport) => fake.answer(0, { ok: false, reason: "rejected" }),
    },
    { kind: "thrown", reply: (fake: FakeTransport) => fake.fail(0) },
  ];

  for (const { kind, reply } of previousAccountReplies) {
    test(`a ${kind} reply from the previous account never reaches the next account, whose tap goes out after it`, async () => {
      const fake = setup();
      const { owner, sent, answer, writes } = fake;
      owner.startSession(OWNER);
      owner.receiveSnapshot({ ok: true, ownerId: OWNER, marks: {} });
      owner.requestChange(tapDeu);
      owner.requestChange(tapFra);
      await flush();

      owner.endSession();
      owner.startSession(OTHER_OWNER);
      owner.receiveSnapshot({ ok: true, ownerId: OTHER_OWNER, marks: {} });
      owner.requestChange(tapIta);
      await flush();

      expect(sent()).toEqual([[OWNER, tapDeu]]);

      await reply(fake);

      expect(visibleMarks(owner.getState())).toEqual({ ITA: "visited" });
      expect(owner.getState().problems).toEqual([]);
      expect(writes).toEqual([
        { ownerId: OWNER, marks: {} },
        { ownerId: OTHER_OWNER, marks: {} },
      ]);
      expect(sent()).toEqual([
        [OWNER, tapDeu],
        [OTHER_OWNER, tapIta],
      ]);

      await answer(1);

      expect(sent()).toEqual([
        [OWNER, tapDeu],
        [OTHER_OWNER, tapIta],
      ]);
      expect(visibleMarks(owner.getState())).toEqual({ ITA: "visited" });
      expect(writes).toEqual([
        { ownerId: OWNER, marks: {} },
        { ownerId: OTHER_OWNER, marks: {} },
        { ownerId: OTHER_OWNER, marks: { ITA: "visited" } },
      ]);
    });
  }

  test("switching accounts without ending the session holds the next account's tap until the previous reply", async () => {
    const { owner, sent, answer } = setup();
    owner.startSession(OWNER);
    owner.receiveSnapshot({ ok: true, ownerId: OWNER, marks: {} });
    owner.requestChange(tapDeu);
    await flush();

    owner.startSession(OTHER_OWNER);
    owner.receiveSnapshot({ ok: true, ownerId: OTHER_OWNER, marks: {} });
    owner.requestChange(tapIta);
    await flush();

    expect(sent()).toEqual([[OWNER, tapDeu]]);

    await answer(0);

    expect(visibleMarks(owner.getState())).toEqual({ ITA: "visited" });
    expect(sent()).toEqual([
      [OWNER, tapDeu],
      [OTHER_OWNER, tapIta],
    ]);
  });
});

describe("D1, appeared in 1d566f9, open on PR #41: a request that never settles holds every later change and account", () => {
  test("a request that never settles rolls back and records why once the deadline passes", async () => {
    const { owner, sent, expire } = setup();
    owner.startSession(OWNER);
    owner.receiveSnapshot({ ok: true, ownerId: OWNER, marks: { FRA: "want" } });
    owner.requestChange(tapDeu);
    await flush();

    expect(visibleMarks(owner.getState())).toEqual({ FRA: "want", DEU: "visited" });

    await expire(0);

    expect(sent()).toEqual([[OWNER, tapDeu]]);
    expect(visibleMarks(owner.getState())).toEqual({ FRA: "want" });
    expect(owner.getState().problems).toEqual([{ scope: "DEU", reason: "unavailable" }]);
  });

  test("a late reply after the deadline releases the lane, and the reset waits for it", async () => {
    const { owner, sent, answer, expire } = setup();
    owner.startSession(OWNER);
    owner.receiveSnapshot({ ok: true, ownerId: OWNER, marks: {} });
    owner.requestChange(tapDeu);
    await flush();
    await expire(0);

    owner.requestChange(resetAll);
    owner.requestChange(tapFra);
    await flush();

    expect(sent()).toEqual([[OWNER, tapDeu]]);
    expect(visibleMarks(owner.getState())).toEqual({ FRA: "want" });

    await answer(0);

    expect(sent()).toEqual([
      [OWNER, tapDeu],
      [OWNER, resetAll],
    ]);
    expect(owner.getState().problems).toEqual([]);

    await answer(1);
    await answer(2);

    expect(sent()).toEqual([
      [OWNER, tapDeu],
      [OWNER, resetAll],
      [OWNER, tapFra],
    ]);
  });

  test("the next account's tap goes out once the stalled request settles and never shows the previous account's change", async () => {
    const { owner, sent, answer, expire } = setup();
    owner.startSession(OWNER);
    owner.receiveSnapshot({ ok: true, ownerId: OWNER, marks: {} });
    owner.requestChange(tapDeu);
    await flush();

    owner.endSession();
    owner.startSession(OTHER_OWNER);
    owner.requestChange(tapIta);
    await expire(0);

    expect(sent()).toEqual([[OWNER, tapDeu]]);
    expect(visibleMarks(owner.getState())).toEqual({ ITA: "visited" });

    await answer(0);

    expect(sent()).toEqual([
      [OWNER, tapDeu],
      [OTHER_OWNER, tapIta],
    ]);
    expect(visibleMarks(owner.getState())).toEqual({ ITA: "visited" });
    expect(owner.getState().problems).toEqual([]);
  });
});

describe("marks owner", () => {
  test("taps before the session starts are sent after it with that owner id", async () => {
    const { owner, sent } = setup();
    owner.requestChange(tapDeu);
    await flush();

    expect(sent()).toEqual([]);

    owner.startSession(OWNER);
    await flush();

    expect(sent()).toEqual([[OWNER, tapDeu]]);
  });

  test("a tap in flight is not sent again by a later event", async () => {
    const { owner, sent } = setup();
    owner.startSession(OWNER);
    owner.requestChange(tapDeu);
    owner.receiveSnapshot({ ok: true, ownerId: OWNER, marks: {} });
    await flush();

    expect(sent()).toEqual([[OWNER, tapDeu]]);
  });

  test("a saved change makes the next waiting change go out", async () => {
    const { owner, sent, answer } = setup();
    owner.startSession(OWNER);
    owner.requestChange(tapDeu);
    owner.requestChange(tapFra);
    await flush();
    await answer(0);

    expect(sent()).toEqual([
      [OWNER, tapDeu],
      [OWNER, tapFra],
    ]);
    expect(owner.getState().pending.map((entry) => entry.phase)).toEqual(["saved", "sending"]);
  });

  test("a rejected send settles as unavailable and rolls the screen back", async () => {
    const { owner, fail } = setup();
    owner.startSession(OWNER);
    owner.receiveSnapshot({ ok: true, ownerId: OWNER, marks: { FRA: "want" } });
    owner.requestChange(tapDeu);
    await flush();

    expect(visibleMarks(owner.getState())).toEqual({ FRA: "want", DEU: "visited" });

    await fail(0);

    expect(visibleMarks(owner.getState())).toEqual({ FRA: "want" });
    expect(owner.getState().problems).toEqual([{ scope: "DEU", reason: "unavailable" }]);
  });

  test("a send that throws at once settles as unavailable and the next change still goes out", async () => {
    const calls: MarkChange[] = [];

    const transport: MarksTransport = {
      applyMarkChange: (_expectedOwnerId, change) => {
        calls.push(change);

        if (change.kind === "set" && change.code === "DEU") throw new Error("encode failed");

        return Promise.resolve(SAVED);
      },
      readMarks: () => new Promise(() => {}),
    };

    const owner = createMarksOwner(transport, fakeCache().cache, fakeDeadline().startDeadline);

    owner.startSession(OWNER);
    owner.receiveSnapshot({ ok: true, ownerId: OWNER, marks: {} });
    owner.requestChange(tapDeu);
    owner.requestChange(tapFra);
    await flush();

    expect(calls).toEqual([tapDeu, tapFra]);
    expect(visibleMarks(owner.getState())).toEqual({ FRA: "want" });
    expect(owner.getState().problems).toEqual([{ scope: "DEU", reason: "unavailable" }]);
  });

  test("the cache is written for a server base and again when a saved change moves it", async () => {
    const { owner, answer, writes } = setup();
    owner.startSession(OWNER);
    owner.receiveSnapshot({ ok: true, ownerId: OWNER, marks: { FRA: "want" } });

    expect(writes).toEqual([{ ownerId: OWNER, marks: { FRA: "want" } }]);

    owner.requestChange(tapDeu);
    await flush();

    expect(writes).toHaveLength(1);

    await answer(0);

    expect(writes).toEqual([
      { ownerId: OWNER, marks: { FRA: "want" } },
      { ownerId: OWNER, marks: { FRA: "want", DEU: "visited" } },
    ]);
  });

  test("the cache is never written for a cache base", async () => {
    const { owner, answer, writes } = setup({ stored: { ownerId: OWNER, marks: { FRA: "want" } } });
    owner.startSession(OWNER);
    owner.requestChange(tapDeu);
    await flush();
    await answer(0);

    expect(owner.getState().base).toEqual({
      source: "cache",
      marks: { FRA: "want", DEU: "visited" },
    });
    expect(writes).toEqual([]);
  });

  test("the cache is never written for an empty base", async () => {
    const { owner, answer, writes } = setup();
    owner.startSession(OWNER);
    owner.requestChange(tapDeu);
    await flush();
    await answer(0);

    expect(visibleMarks(owner.getState())).toEqual({ DEU: "visited" });
    expect(writes).toEqual([]);
  });

  test("a reply for another account rolls the change back and records why", async () => {
    const { owner, answer } = setup();
    owner.startSession(OWNER);
    owner.receiveSnapshot({ ok: true, ownerId: OWNER, marks: { FRA: "want" } });
    owner.requestChange(tapDeu);
    await flush();
    await answer(0, { ok: false, reason: "other-account" });

    expect(visibleMarks(owner.getState())).toEqual({ FRA: "want" });
    expect(owner.getState().problems).toEqual([{ scope: "DEU", reason: "other-account" }]);
  });

  test("a cached snapshot shows at session start", () => {
    const { owner } = setup({ stored: { ownerId: OWNER, marks: { FRA: "want" } } });
    owner.startSession(OWNER);

    expect(visibleMarks(owner.getState())).toEqual({ FRA: "want" });
  });

  test("a cache from another owner shows nothing", () => {
    const { owner } = setup({ stored: { ownerId: OTHER_OWNER, marks: { FRA: "want" } } });
    owner.startSession(OWNER);

    expect(visibleMarks(owner.getState())).toEqual({});
  });

  test("a cache that throws on read counts as empty and changes still send", async () => {
    const { owner, sent } = setup({ readFails: true });
    owner.startSession(OWNER);
    owner.requestChange(tapDeu);
    await flush();

    expect(owner.getState().base).toEqual({ source: "empty" });
    expect(sent()).toEqual([[OWNER, tapDeu]]);
  });

  test("a cache that throws on write is ignored and the next change still sends", async () => {
    const { owner, sent, answer } = setup({ writeFails: true });
    owner.startSession(OWNER);
    owner.receiveSnapshot({ ok: true, ownerId: OWNER, marks: {} });
    owner.requestChange(tapDeu);
    owner.requestChange(tapFra);
    await flush();
    await answer(0);

    expect(visibleMarks(owner.getState())).toEqual({ DEU: "visited", FRA: "want" });
    expect(sent()).toEqual([
      [OWNER, tapDeu],
      [OWNER, tapFra],
    ]);
  });

  test("a session that ended sends nothing new", async () => {
    const { owner, sent } = setup();
    owner.startSession(OWNER);
    owner.endSession();
    owner.requestChange(tapDeu);
    await flush();

    expect(sent()).toEqual([]);
  });
});

describe("marks owner listeners", () => {
  test("a listener hears every change until it unsubscribes", async () => {
    const { owner, answer } = setup();
    let heard = 0;

    const unsubscribe = owner.subscribe(() => {
      heard += 1;
    });

    owner.startSession(OWNER);
    owner.requestChange(tapDeu);
    await flush();

    expect(heard).toBe(3);

    unsubscribe();
    await answer(0);

    expect(heard).toBe(3);
  });

  test("an event that changes nothing reaches no listener and writes no cache", () => {
    const { owner, writes } = setup();
    owner.startSession(OWNER);
    owner.receiveSnapshot({ ok: true, ownerId: OWNER, marks: {} });
    let heard = 0;
    const writesBefore = writes.length;

    owner.subscribe(() => {
      heard += 1;
    });
    owner.startSession(OWNER);
    owner.endSession();
    owner.requestChange(tapDeu);

    expect(heard).toBe(1);
    expect(writes.length).toBe(writesBefore);
  });
});
