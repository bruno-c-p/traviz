import { describe, expect, test } from "bun:test";
import { clerkJSScriptUrl } from "@clerk/shared/loadClerkJsScript";
import { clerkScriptUrl, createClerkSession } from "@/features/auth/clerk-session";

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

  const emit = (next: FakeUser | null) => {
    user = next;

    for (const callback of callbacks) callback({ user });
  };

  const clerk = {
    loaded,
    load: async () => {
      events.push("load");
      clerk.loaded = true;
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
  };
}

function createHarness({
  alreadyLoaded = false,
  user = userWithEmail("ada@example.com"),
}: { alreadyLoaded?: boolean; user?: FakeUser | null } = {}) {
  const events: string[] = [];
  const failures: unknown[] = [];
  const pageLoadCallbacks: (() => void)[] = [];
  const fake = createFakeClerk(events, user, alreadyLoaded);
  let scriptRan = alreadyLoaded;
  let scriptFailure: Error | null = null;

  const session = createClerkSession({
    currentClerk: () => (scriptRan ? fake.clerk : undefined),
    loadScript: async () => {
      events.push("loadScript");

      if (scriptFailure) throw scriptFailure;

      scriptRan = true;
    },
    afterPageLoad: (callback) => {
      pageLoadCallbacks.push(callback);
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
    finishPageLoad: () => {
      for (const callback of pageLoadCallbacks.splice(0)) callback();
    },
    failScript: (error: Error | null) => {
      scriptFailure = error;
    },
  };
}

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

  test("a failed load is reported and the next request tries again", async () => {
    const harness = createHarness();
    const outage = new Error("offline");
    harness.failScript(outage);

    harness.session.loadAfterPage();
    harness.finishPageLoad();
    await flush();

    expect(harness.failures).toEqual([outage]);

    harness.failScript(null);
    await harness.session.signOut("/sign-in", () => {});

    expect(harness.events).toEqual(["loadScript", "loadScript", "load", "signOut /sign-in"]);
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
