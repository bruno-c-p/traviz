import { afterEach, describe, expect, test } from "bun:test";
import type { Marks } from "@/features/marks/colors";
import {
  createMarksOwner,
  type MarksCache,
  type MarksDeadline,
  type MarksTransport,
} from "@/features/marks/marks-owner";
import {
  applyChange,
  type CachedMarks,
  type MarkChange,
  type MarkChangeResult,
  type MarksSnapshot,
} from "@/features/marks/marks-sync";
import { createMarksStore, endMarksSession, useCountriesStore } from "@/features/marks/marks-store";
import { createFakeStorage } from "@/shared/testing/fake-storage";

const OWNER = "user_a";
const OTHER_OWNER = "user_b";

const SAVED: MarkChangeResult = { ok: true };

type Pending<T> = {
  readonly resolve: (value: T) => void;
  readonly reject: (cause: unknown) => void;
};

type ChangeCall = Pending<MarkChangeResult> & {
  readonly expectedOwnerId: string;
  readonly change: MarkChange;
};

type ReadCall = Pending<MarksSnapshot> & { readonly expectedOwnerId: string };

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function fakeTransport(options: { readThrows?: boolean } = {}) {
  const changes: ChangeCall[] = [];
  const reads: ReadCall[] = [];
  let serverMarks: Marks = {};

  const transport: MarksTransport = {
    applyMarkChange: (expectedOwnerId, change) =>
      new Promise((resolve, reject) => {
        changes.push({ expectedOwnerId, change, resolve, reject });
      }),
    readMarks: (expectedOwnerId) => {
      if (options.readThrows === true) throw new Error("encode failed");

      return new Promise((resolve, reject) => {
        reads.push({ expectedOwnerId, resolve, reject });
      });
    },
  };

  const answer = async (index: number, result: MarkChangeResult = SAVED) => {
    const call = changes[index];

    if (call === undefined) throw new Error(`no change ${index}`);

    if (result.ok) serverMarks = applyChange(serverMarks, call.change);

    call.resolve(result);
    await flush();
  };

  const fail = async (index: number) => {
    changes[index]?.reject(new Error("network down"));
    await flush();
  };

  const answerRead = async (index: number, marks: Marks = serverMarks) => {
    const read = reads[index];

    if (read === undefined) throw new Error(`no read ${index}`);

    read.resolve({ ok: true, ownerId: read.expectedOwnerId, marks });
    await flush();
  };

  const failRead = async (index: number) => {
    reads[index]?.reject(new Error("network down"));
    await flush();
  };

  const refuseRead = async (index: number) => {
    const read = reads[index];
    read?.resolve({ ok: false, ownerId: read.expectedOwnerId });
    await flush();
  };

  return {
    transport,
    sent: () => changes.map((call) => [call.expectedOwnerId, call.change]),
    readsFor: () => reads.map((read) => read.expectedOwnerId),
    answer,
    fail,
    answerRead,
    failRead,
    refuseRead,
  };
}

function fakeCache(stored: CachedMarks | null = null, options: { clearThrows?: boolean } = {}) {
  let slot = stored;

  const cache: MarksCache = {
    read: () => slot,
    write: (cached) => {
      slot = cached;
    },
    clear: () => {
      if (options.clearThrows === true) throw new Error("storage blocked");

      slot = null;
    },
  };

  return { cache, slot: () => slot };
}

function fakeDeadline() {
  const expiries: (() => void)[] = [];

  const startDeadline: MarksDeadline = (onExpired) => {
    expiries.push(onExpired);
  };

  const expire = async (index: number) => {
    expiries[index]?.();
    await flush();
  };

  return { startDeadline, expire };
}

function setup({
  stored = null,
  readThrows = false,
  clearThrows = false,
}: { stored?: CachedMarks | null; readThrows?: boolean; clearThrows?: boolean } = {}) {
  const fake = fakeTransport({ readThrows });
  const cache = fakeCache(stored, { clearThrows });
  const deadline = fakeDeadline();

  const store = createMarksStore(
    createMarksOwner(fake.transport, cache.cache, deadline.startDeadline),
  );

  const signIn = (ownerId: string, marks: Marks = {}) => {
    store.getState().startSession(ownerId);
    store.getState().receiveSnapshot({ ok: true, ownerId, marks });
  };

  return { ...fake, ...deadline, cacheSlot: cache.slot, store, signIn };
}

const tapDeu: MarkChange = { kind: "set", code: "DEU", state: "visited" };
const tapFra: MarkChange = { kind: "set", code: "FRA", state: "want" };

describe("R-9: a tap in the sync window survives the snapshot", () => {
  test("a tap before the snapshot shows on top of the snapshot and is sent", async () => {
    const { store, sent } = setup();
    store.getState().startSession(OWNER);
    store.getState().toggle("DEU", "visited");
    store.getState().receiveSnapshot({ ok: true, ownerId: OWNER, marks: { FRA: "want" } });
    await flush();

    expect(store.getState().marks).toEqual({ FRA: "want", DEU: "visited" });
    expect(sent()).toEqual([[OWNER, tapDeu]]);
  });
});

describe("F16.1: a reset before sync wins", () => {
  test("a snapshot after a pending reset shows no marks", async () => {
    const { store } = setup();
    store.getState().startSession(OWNER);
    store.getState().resetAll();
    store.getState().receiveSnapshot({ ok: true, ownerId: OWNER, marks: { FRA: "want" } });
    await flush();

    expect(store.getState().marks).toEqual({});
  });
});

describe("F16.3: a rejected pre-sync edit is not replayed", () => {
  test("the snapshot after a rejected tap does not bring the tap back", async () => {
    const { store, answer } = setup();
    store.getState().startSession(OWNER);
    store.getState().toggle("DEU", "visited");
    await flush();
    await answer(0, { ok: false, reason: "rejected" });
    store.getState().receiveSnapshot({ ok: true, ownerId: OWNER, marks: {} });

    expect(store.getState().marks).toEqual({});
    expect(store.getState().problems).toEqual([{ scope: "DEU", reason: "rejected" }]);
  });
});

describe("M3: a failed write rolls back and leaves a per-country problem", () => {
  test("a write that fails shows the earlier colour and a problem for that country", async () => {
    const { store, signIn, fail } = setup();
    signIn(OWNER, { FRA: "want" });
    store.getState().toggle("FRA", "visited");
    await flush();

    expect(store.getState().marks).toEqual({ FRA: "visited" });

    await fail(0);

    expect(store.getState().marks).toEqual({ FRA: "want" });
    expect(store.getState().problems).toEqual([{ scope: "FRA", reason: "unavailable" }]);
  });
});

describe("F5.1: one country's success keeps another country's problem", () => {
  test("a saved tap on France keeps Germany's problem", async () => {
    const { store, signIn, fail, answer } = setup();
    signIn(OWNER);
    store.getState().toggle("DEU", "visited");
    store.getState().toggle("FRA", "want");
    await flush();
    await fail(0);
    await answer(1);

    expect(store.getState().marks).toEqual({ FRA: "want" });
    expect(store.getState().problems).toEqual([{ scope: "DEU", reason: "unavailable" }]);
  });
});

describe("write, reset, write", () => {
  test("the changes reach the server one at a time in tap order", async () => {
    const { store, signIn, sent, answer } = setup();
    signIn(OWNER);
    store.getState().toggle("DEU", "visited");
    store.getState().resetAll();
    store.getState().toggle("FRA", "want");
    await flush();

    expect(sent()).toEqual([[OWNER, tapDeu]]);

    await answer(0);
    await answer(1);
    await answer(2);

    expect(sent()).toEqual([
      [OWNER, tapDeu],
      [OWNER, { kind: "reset" }],
      [OWNER, tapFra],
    ]);
    expect(store.getState().marks).toEqual({ FRA: "want" });
  });
});

describe("F5.2: a reply from the ended session never reaches the next account", () => {
  test("the previous account's saved tap does not show for the next account", async () => {
    const { store, signIn, sent, answer } = setup();
    signIn(OWNER);
    store.getState().toggle("DEU", "visited");
    await flush();

    store.getState().endSession();
    signIn(OTHER_OWNER);
    store.getState().toggle("FRA", "want");
    await answer(0);

    expect(store.getState().marks).toEqual({ FRA: "want" });
    expect(store.getState().problems).toEqual([]);
    expect(sent()).toEqual([
      [OWNER, tapDeu],
      [OTHER_OWNER, tapFra],
    ]);
  });
});

describe("two tabs on different accounts", () => {
  test("a write refused for another account rolls back and says so", async () => {
    const { store, signIn, answer } = setup();
    signIn(OWNER, { FRA: "want" });
    store.getState().toggle("DEU", "visited");
    await flush();
    await answer(0, { ok: false, reason: "other-account" });

    expect(store.getState().marks).toEqual({ FRA: "want" });
    expect(store.getState().problems).toEqual([{ scope: "DEU", reason: "other-account" }]);
  });
});

describe("saving", () => {
  test("a country is saving until its write settles", async () => {
    const { store, signIn, answer } = setup();
    signIn(OWNER);
    store.getState().toggle("DEU", "visited");
    store.getState().clear("FRA");
    await flush();

    expect(store.getState().saving).toEqual(["DEU", "FRA"]);

    await answer(0);

    expect(store.getState().saving).toEqual(["FRA"]);

    await answer(1);

    expect(store.getState().saving).toEqual([]);
  });

  test("every country is saving while a reset is pending", async () => {
    const { store, signIn, answer } = setup();
    signIn(OWNER);
    store.getState().toggle("DEU", "visited");
    store.getState().resetAll();
    await flush();

    expect(store.getState().saving).toBe("all");

    await answer(0);
    await answer(1);

    expect(store.getState().saving).toEqual([]);
  });
});

describe("a late reply after the deadline", () => {
  test("a saved late reply brings the colour back and dismisses the problem", async () => {
    const { store, signIn, answer, expire, readsFor, answerRead } = setup();
    signIn(OWNER, { FRA: "want" });
    store.getState().toggle("DEU", "visited");
    await flush();
    await expire(0);

    expect(store.getState().marks).toEqual({ FRA: "want" });
    expect(store.getState().problems).toEqual([{ scope: "DEU", reason: "unavailable" }]);

    await answer(0);

    expect(readsFor()).toEqual([OWNER]);

    await answerRead(0, { FRA: "want", DEU: "visited" });

    expect(store.getState().marks).toEqual({ FRA: "want", DEU: "visited" });
    expect(store.getState().problems).toEqual([]);
  });

  test("a refused late reply keeps the problem and still reads a fresh snapshot", async () => {
    const { store, signIn, answer, expire, readsFor, answerRead } = setup();
    signIn(OWNER);
    store.getState().toggle("DEU", "visited");
    await flush();
    await expire(0);
    await answer(0, { ok: false, reason: "rejected" });

    expect(readsFor()).toEqual([OWNER]);

    await answerRead(0, { FRA: "want" });

    expect(store.getState().marks).toEqual({ FRA: "want" });
    expect(store.getState().problems).toEqual([{ scope: "DEU", reason: "unavailable" }]);
  });

  test("a reply that settles before the deadline reads no snapshot", async () => {
    const { store, signIn, answer, expire, readsFor } = setup();
    signIn(OWNER);
    store.getState().toggle("DEU", "visited");
    await flush();
    await answer(0);
    await expire(0);

    expect(readsFor()).toEqual([]);
    expect(store.getState().problems).toEqual([]);
  });

  test("a late reply from an ended session reads nothing for the next account", async () => {
    const { store, signIn, answer, expire, readsFor } = setup();
    signIn(OWNER);
    store.getState().toggle("DEU", "visited");
    await flush();
    await expire(0);

    store.getState().endSession();
    signIn(OTHER_OWNER);
    await answer(0);

    expect(readsFor()).toEqual([]);
  });

  test("a late reply after switching accounts without ending the session reads nothing", async () => {
    const { store, signIn, answer, expire, readsFor } = setup();
    signIn(OWNER);
    store.getState().toggle("DEU", "visited");
    await flush();
    await expire(0);

    signIn(OTHER_OWNER);
    await answer(0);

    expect(readsFor()).toEqual([]);
  });

  test("a fresh read that lands after the session changed is dropped", async () => {
    const { store, signIn, answer, expire, answerRead } = setup();
    signIn(OWNER);
    store.getState().toggle("DEU", "visited");
    await flush();
    await expire(0);
    await answer(0);

    store.getState().endSession();
    signIn(OWNER);
    await answerRead(0, { DEU: "visited" });

    expect(store.getState().marks).toEqual({});
  });

  for (const readThrows of [false, true]) {
    test(`a fresh read that ${readThrows ? "throws" : "fails"} leaves the screen as it was`, async () => {
      const { store, signIn, answer, expire, failRead } = setup({ readThrows });
      signIn(OWNER);
      store.getState().toggle("DEU", "visited");
      await flush();
      await expire(0);
      await answer(0);
      await failRead(0);
      store.getState().toggle("FRA", "want");
      await flush();

      expect(store.getState().marks).toEqual({ FRA: "want" });
      expect(store.getState().problems).toEqual([{ scope: "DEU", reason: "unavailable" }]);
    });
  }
});

describe("snapshot order", () => {
  test("the session's first snapshot arriving after a fresh read is dropped", async () => {
    const { store, answer, expire, answerRead } = setup();
    store.getState().startSession(OWNER);
    store.getState().toggle("DEU", "visited");
    await flush();
    await expire(0);
    await answer(0);
    await answerRead(0, { DEU: "visited" });

    store.getState().receiveSnapshot({ ok: true, ownerId: OWNER, marks: {} });

    expect(store.getState().marks).toEqual({ DEU: "visited" });
  });

  test("an older fresh read arriving after a newer one is dropped", async () => {
    const { store, signIn, answer, expire, answerRead } = setup();
    signIn(OWNER);
    store.getState().toggle("DEU", "visited");
    await flush();
    await expire(0);
    store.getState().toggle("FRA", "want");
    await answer(0);
    await expire(1);
    await answer(1);
    await answerRead(1, { DEU: "visited", FRA: "want" });
    await answerRead(0, { DEU: "visited" });

    expect(store.getState().marks).toEqual({ DEU: "visited", FRA: "want" });
  });

  test("a failed fresh snapshot does not hide an older good one", async () => {
    const { store, answer, expire, refuseRead } = setup();
    store.getState().startSession(OWNER);
    store.getState().toggle("DEU", "visited");
    await flush();
    await expire(0);
    await answer(0);
    await refuseRead(0);

    expect(store.getState().problems).toContainEqual({ scope: "snapshot", reason: "unavailable" });

    store.getState().receiveSnapshot({ ok: true, ownerId: OWNER, marks: { FRA: "want" } });

    expect(store.getState().marks).toEqual({ FRA: "want" });
  });

  test("starting the same owner's session again keeps the count", async () => {
    const { store, signIn, answer, expire, answerRead } = setup();
    signIn(OWNER);
    store.getState().toggle("DEU", "visited");
    await flush();
    await expire(0);
    await answer(0);
    await answerRead(0, { DEU: "visited" });

    signIn(OWNER);

    expect(store.getState().marks).toEqual({ DEU: "visited" });
  });

  test("a new session counts its snapshots from the start", async () => {
    const { store, signIn, answer, expire, answerRead } = setup();
    signIn(OWNER);
    store.getState().toggle("DEU", "visited");
    await flush();
    await expire(0);
    await answer(0);
    await answerRead(0, { DEU: "visited" });

    store.getState().endSession();
    signIn(OWNER, { ITA: "want" });

    expect(store.getState().marks).toEqual({ ITA: "want" });
  });
});

describe("ending the session", () => {
  test("ending the session clears the cache", () => {
    const { store, signIn, cacheSlot } = setup();
    signIn(OWNER, { FRA: "want" });

    expect(cacheSlot()).toEqual({ ownerId: OWNER, marks: { FRA: "want" } });

    store.getState().endSession();

    expect(cacheSlot()).toBeNull();
    expect(store.getState().marks).toEqual({});
    expect(store.getState().ownerId).toBeNull();
  });

  test("a cache that throws on clear still ends the session", () => {
    const { store, signIn } = setup({ clearThrows: true });
    signIn(OWNER, { FRA: "want" });

    store.getState().endSession();

    expect(store.getState().marks).toEqual({});
    expect(store.getState().ownerId).toBeNull();
  });

  describe("endMarksSession", () => {
    afterEach(() => {
      Reflect.deleteProperty(globalThis, "localStorage");
    });

    test("endMarksSession clears the browser cache and the retired key", () => {
      const { storage, items } = createFakeStorage({
        "traviz-marks-v2": "ownerId=user_a&FRA=want",
        "traviz-marks": '{"state":{"marks":{}}}',
      });

      Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
      useCountriesStore.getState().startSession(OWNER);

      expect(useCountriesStore.getState().marks).toEqual({ FRA: "want" });

      endMarksSession();

      expect(items()).toEqual({});
      expect(useCountriesStore.getState().marks).toEqual({});
    });
  });
});

describe("dismissing a problem", () => {
  test("dismissing a country's problem removes only that problem", async () => {
    const { store, signIn, fail } = setup();
    signIn(OWNER);
    store.getState().toggle("DEU", "visited");
    store.getState().toggle("FRA", "want");
    await flush();
    await fail(0);
    await fail(1);

    store.getState().dismissProblem("DEU");

    expect(store.getState().problems).toEqual([{ scope: "FRA", reason: "unavailable" }]);
  });
});

describe("the cached marks", () => {
  test("the owner's cached marks show before the snapshot", () => {
    const { store } = setup({ stored: { ownerId: OWNER, marks: { FRA: "want" } } });
    store.getState().startSession(OWNER);

    expect(store.getState().marks).toEqual({ FRA: "want" });
    expect(store.getState().ownerId).toBe(OWNER);
  });

  test("toggling the shown state clears the mark", async () => {
    const { store, signIn, sent } = setup();
    signIn(OWNER, { FRA: "want" });
    store.getState().toggle("FRA", "want");
    await flush();

    expect(store.getState().marks).toEqual({});
    expect(sent()).toEqual([[OWNER, { kind: "clear", code: "FRA" }]]);
  });
});
