import { describe, expect, test } from "bun:test";
import { clerkJSScriptUrl } from "@clerk/shared/loadClerkJsScript";
import {
  clerkScriptUrl,
  createClerkSession,
  RETRY_DELAYS_MS,
  LOAD_TIMEOUT_MS,
} from "@/features/auth/clerk-session";

type FakeUser = { readonly primaryEmailAddress: { readonly emailAddress: string } | null };

type Emission = { readonly user?: FakeUser | null };

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const userWithEmail = (emailAddress: string): FakeUser => ({
  primaryEmailAddress: { emailAddress },
});

function createFakeClerk(events: string[], initialUser: FakeUser | null, loaded: boolean) {
  const callbacks = new Set<(resources: Emission) => void>();
  let user = initialUser;
  let signOutFailure: Error | null = null;
  let finishStalledLoad: (() => void) | null = null;
  let loadStalls = false;

  const emit = (next: FakeUser | null) => {
    user = next;

    for (const callback of callbacks) callback({ user });
  };

  const clerk = {
    loaded,
    load: () => {
      events.push("load");

      if (loadStalls)
        return new Promise<void>((resolve) => {
          finishStalledLoad = () => {
            clerk.loaded = true;
            resolve();
          };
        });

      clerk.loaded = true;

      return Promise.resolve();
    },
    addListener: (callback: (resources: Emission) => void) => {
      callbacks.add(callback);
      callback({ user });

      return () => {
        callbacks.delete(callback);
      };
    },
    signOut: async ({ redirectUrl }: { readonly redirectUrl: string }) => {
      events.push(`signOut ${redirectUrl}`);

      if (signOutFailure) throw signOutFailure;

      emit(null);
    },
  };

  return {
    clerk,
    emit,
    failSignOut: (error: Error) => {
      signOutFailure = error;
    },
    stallLoad: () => {
      loadStalls = true;
    },
    finishLoad: () => finishStalledLoad?.(),
  };
}

type ScriptBehaviour = "runs" | "fails" | "stalls";

function createFakeClock() {
  const timers: { at: number; callback: () => void; live: boolean }[] = [];
  let now = 0;

  const startTimer = (callback: () => void, milliseconds: number) => {
    const timer = { at: now + milliseconds, callback, live: true };
    timers.push(timer);

    return () => {
      timer.live = false;
    };
  };

  const advance = async (milliseconds: number) => {
    const until = now + milliseconds;

    for (;;) {
      await flush();

      const due = timers
        .filter((timer) => timer.live && timer.at <= until)
        .toSorted((left, right) => left.at - right.at)[0];

      if (due === undefined) break;

      now = due.at;
      due.live = false;
      due.callback();
    }

    now = until;
  };

  return { startTimer, advance };
}

function createHarness({
  alreadyLoaded = false,
  user = userWithEmail("ada@example.com"),
}: { alreadyLoaded?: boolean; user?: FakeUser | null } = {}) {
  const events: string[] = [];
  const failures: unknown[] = [];
  const pageLoadCallbacks: (() => void)[] = [];
  const recoveryCallbacks = new Set<() => void>();
  const fake = createFakeClerk(events, user, alreadyLoaded);
  const clock = createFakeClock();
  let scriptRan = alreadyLoaded;
  let scriptBehaviour: ScriptBehaviour = "runs";
  const attempts: number[] = [];

  const session = createClerkSession({
    currentClerk: () => (scriptRan ? fake.clerk : undefined),
    loadScript: (attempt, abort) => {
      events.push("loadScript");
      attempts.push(attempt);

      if (scriptBehaviour === "fails") return Promise.reject(new Error("offline"));

      if (scriptBehaviour === "stalls") {
        return new Promise((_resolve, reject) => {
          abort.addEventListener("abort", () => {
            events.push("script removed");
            reject(new Error("timed out"));
          });
        });
      }

      scriptRan = true;

      return Promise.resolve();
    },
    afterPageLoad: (callback) => {
      pageLoadCallbacks.push(callback);
    },
    startTimer: clock.startTimer,
    whenRecoverable: (callback) => {
      recoveryCallbacks.add(callback);

      return () => {
        recoveryCallbacks.delete(callback);
      };
    },
    reportLoadFailure: (cause) => {
      failures.push(cause);
    },
  });

  return {
    session,
    events,
    failures,
    fake,
    advance: clock.advance,
    finishPageLoad: () => {
      for (const callback of pageLoadCallbacks.splice(0)) callback();
    },
    setScript: (behaviour: ScriptBehaviour) => {
      scriptBehaviour = behaviour;
    },
    recover: async () => {
      for (const callback of recoveryCallbacks) callback();
      await flush();
    },
    recoveryWatchers: () => recoveryCallbacks.size,
    attempts,
  };
}

const ALL_RETRIES_MS = RETRY_DELAYS_MS.reduce((total, delay) => total + delay, 0);
const ATTEMPTS = RETRY_DELAYS_MS.length + 1;

describe("loading clerk-js", () => {
  test("nothing loads until the page has finished loading", async () => {
    const harness = createHarness();

    harness.session.loadAfterPage();
    await flush();

    expect(harness.events).toEqual([]);

    harness.finishPageLoad();
    await flush();

    expect(harness.events).toEqual(["loadScript", "load"]);
  });

  test("the script and Clerk.load run once however often loading is asked for", async () => {
    const harness = createHarness();

    harness.session.loadAfterPage();
    harness.session.loadAfterPage();
    harness.finishPageLoad();
    harness.session.loadAfterPage();
    await Promise.all([harness.session.signOut("/sign-in", () => {}), flush()]);

    expect(harness.events.filter((event) => event === "loadScript")).toHaveLength(1);
    expect(harness.events.filter((event) => event === "load")).toHaveLength(1);
  });

  test("a Clerk the sign-in pages already loaded is reused at once, with no script and no second load", async () => {
    const harness = createHarness({ alreadyLoaded: true });

    harness.session.loadAfterPage();
    await flush();

    expect(harness.events).toEqual([]);
    expect(harness.session.email()).toBe("ada@example.com");
  });

  test("a dropped script is tried again after a backoff, and the retry loads Clerk once", async () => {
    const harness = createHarness();
    harness.setScript("fails");

    harness.session.loadAfterPage();
    harness.finishPageLoad();
    await flush();

    expect(harness.events).toEqual(["loadScript"]);

    harness.setScript("runs");
    await harness.advance(RETRY_DELAYS_MS[0] - 1);

    expect(harness.events).toEqual(["loadScript"]);

    await harness.advance(1);

    expect(harness.events).toEqual(["loadScript", "loadScript", "load"]);
    expect(harness.failures).toEqual([]);
    expect(harness.session.email()).toBe("ada@example.com");
  });

  test("a script that stalls times out after 15 s, loses its tag and is tried again", async () => {
    const harness = createHarness();
    harness.setScript("stalls");

    harness.session.loadAfterPage();
    harness.finishPageLoad();
    await harness.advance(LOAD_TIMEOUT_MS - 1);

    expect(harness.events).toEqual(["loadScript"]);

    harness.setScript("runs");
    await harness.advance(1);

    expect(harness.events).toEqual(["loadScript", "script removed"]);

    await harness.advance(RETRY_DELAYS_MS[0]);

    expect(harness.events).toEqual(["loadScript", "script removed", "loadScript", "load"]);
  });

  test("every script attempt, recoveries included, is numbered apart so none reuses a stalled request", async () => {
    const harness = createHarness();
    harness.setScript("fails");

    harness.session.loadAfterPage();
    harness.finishPageLoad();
    await harness.advance(ALL_RETRIES_MS);
    harness.setScript("runs");
    await harness.recover();

    expect(harness.attempts).toEqual(Array.from({ length: ATTEMPTS + 1 }, (_, index) => index + 1));
  });

  test("when every attempt fails, the failure is reported once and coming back loads Clerk", async () => {
    const harness = createHarness();
    harness.setScript("fails");

    harness.session.loadAfterPage();
    harness.finishPageLoad();
    await harness.advance(ALL_RETRIES_MS);

    expect(harness.events).toEqual(Array.from({ length: ATTEMPTS }, () => "loadScript"));
    expect(harness.failures).toHaveLength(1);

    harness.setScript("runs");
    await harness.recover();

    expect(harness.events.slice(ATTEMPTS)).toEqual(["loadScript", "load"]);
    expect(harness.session.email()).toBe("ada@example.com");

    await harness.recover();

    expect(harness.events.slice(ATTEMPTS)).toEqual(["loadScript", "load"]);
  });

  test("a Clerk.load that stalls times out, and the retry waits on the same load instead of starting another", async () => {
    const harness = createHarness();
    harness.fake.stallLoad();

    harness.session.loadAfterPage();
    harness.finishPageLoad();
    await harness.advance(LOAD_TIMEOUT_MS + RETRY_DELAYS_MS[0]);

    expect(harness.events).toEqual(["loadScript", "load"]);
    expect(harness.session.email()).toBeNull();

    harness.fake.finishLoad();
    await flush();
    await flush();

    expect(harness.events).toEqual(["loadScript", "load"]);
    expect(harness.session.email()).toBe("ada@example.com");
  });

  test("two recovery events at once start one load and report its failure once", async () => {
    const harness = createHarness();
    harness.setScript("fails");

    harness.session.loadAfterPage();
    harness.finishPageLoad();
    await harness.advance(ALL_RETRIES_MS);
    harness.events.length = 0;
    await harness.recover();
    await harness.recover();
    await harness.advance(ALL_RETRIES_MS);

    expect(harness.failures).toHaveLength(2);
  });

  test("once Clerk loads, nothing watches for recovery any more", async () => {
    const harness = createHarness();
    harness.setScript("fails");

    harness.session.loadAfterPage();
    harness.finishPageLoad();
    await harness.advance(ALL_RETRIES_MS);

    expect(harness.recoveryWatchers()).toBe(1);

    harness.setScript("runs");
    await harness.recover();

    expect(harness.recoveryWatchers()).toBe(0);
  });

  test("a recovery that fails again reports again without watching twice", async () => {
    const harness = createHarness();
    harness.setScript("fails");

    harness.session.loadAfterPage();
    harness.finishPageLoad();
    await harness.advance(ALL_RETRIES_MS);
    await harness.recover();
    await harness.advance(ALL_RETRIES_MS);

    expect(harness.failures).toHaveLength(2);
    expect(harness.recoveryWatchers()).toBe(1);
  });

  test("a request during a failed load tries again", async () => {
    const harness = createHarness();
    harness.setScript("fails");

    harness.session.loadAfterPage();
    harness.finishPageLoad();
    await harness.advance(ALL_RETRIES_MS);

    harness.setScript("runs");
    await harness.session.signOut("/sign-in", () => {});

    expect(harness.events.slice(ATTEMPTS)).toEqual(["loadScript", "load", "signOut /sign-in"]);
  });
});

describe("the account email", () => {
  test("is null until Clerk has loaded, then follows the user", async () => {
    const harness = createHarness();

    expect(harness.session.email()).toBeNull();

    harness.session.loadAfterPage();
    harness.finishPageLoad();
    await flush();

    expect(harness.session.email()).toBe("ada@example.com");

    harness.fake.emit(userWithEmail("grace@example.com"));

    expect(harness.session.email()).toBe("grace@example.com");

    harness.fake.emit(null);

    expect(harness.session.email()).toBeNull();
  });

  test("subscribers hear each change of email and nothing else", async () => {
    const harness = createHarness({ alreadyLoaded: true });
    const heard: (string | null)[] = [];
    harness.session.subscribe(() => heard.push(harness.session.email()));

    harness.session.loadAfterPage();
    await flush();
    harness.fake.emit(userWithEmail("ada@example.com"));
    harness.fake.emit(userWithEmail("grace@example.com"));
    harness.fake.emit(null);

    expect(heard).toEqual(["ada@example.com", "grace@example.com", null]);
  });

  test("an unsubscribed listener hears nothing more", async () => {
    const harness = createHarness({ alreadyLoaded: true });
    const heard: (string | null)[] = [];
    const unsubscribe = harness.session.subscribe(() => heard.push(harness.session.email()));

    unsubscribe();
    harness.session.loadAfterPage();
    await flush();

    expect(heard).toEqual([]);
  });
});

describe("signing out", () => {
  test("before Clerk has loaded, loads it at once, signs out, then ends the marks session", async () => {
    const harness = createHarness();

    harness.session.loadAfterPage();
    await harness.session.signOut("/sign-in", () => harness.events.push("endMarksSession"));

    expect(harness.events).toEqual(["loadScript", "load", "signOut /sign-in", "endMarksSession"]);
  });

  test("a sign-out while the script stalls fails after one load timeout, and loading keeps trying", async () => {
    const harness = createHarness();
    harness.setScript("stalls");
    let outcome = "waiting";

    void harness.session
      .signOut("/sign-in", () => harness.events.push("endMarksSession"))
      .then(
        () => {
          outcome = "signed out";
        },
        () => {
          outcome = "failed";
        },
      );
    await harness.advance(LOAD_TIMEOUT_MS - 1);

    expect(outcome).toBe("waiting");

    await harness.advance(1);

    expect(outcome).toBe("failed");
    expect(harness.events).not.toContain("endMarksSession");

    harness.setScript("runs");
    await harness.advance(RETRY_DELAYS_MS[0]);

    expect(harness.session.email()).toBe("ada@example.com");
  });

  test("a failed sign-out rejects and keeps the marks session", async () => {
    const harness = createHarness({ alreadyLoaded: true });
    const refused = new Error("network");
    harness.fake.failSignOut(refused);

    const failure = await harness.session
      .signOut("/sign-in", () => harness.events.push("endMarksSession"))
      .then(
        () => null,
        (error: unknown) => error,
      );

    expect(failure).toBe(refused);
    expect(harness.events).toEqual(["signOut /sign-in"]);
  });
});

describe("the clerk-js script URL", () => {
  test.each([
    ["a development key", "pk_test_YXdha2UtZHVjay00MjE0LmNsZXJrLmFjY291bnRzLmRldiQ"],
    ["a production key", "pk_live_Y2xlcmsudHJhdml6LmJydW5vY2FyZG96by5jb20uYnIk"],
  ])("matches the URL ClerkProvider renders for %s", (_label, publishableKey) => {
    expect(clerkScriptUrl(publishableKey)).toBe(clerkJSScriptUrl({ publishableKey }));
  });
});
