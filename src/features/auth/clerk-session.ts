import "client-only";
import type { HeadlessBrowserClerk } from "@clerk/shared/types";

declare global {
  interface Window {
    Clerk?: HeadlessBrowserClerk;
    __internal_onAfterSetActive?: () => void;
  }
}

type ClerkUser = {
  readonly primaryEmailAddress: { readonly emailAddress: string } | null;
};

type ClerkHandle = {
  readonly loaded: boolean;
  readonly load: () => Promise<void>;
  readonly addListener: (
    callback: (resources: { readonly user?: ClerkUser | null }) => void,
  ) => () => void;
  readonly signOut: (options: { readonly redirectUrl: string }) => Promise<void>;
};

type ClerkSessionDependencies = {
  readonly currentClerk: () => ClerkHandle | undefined;
  readonly loadScript: (attempt: number, abort: AbortSignal) => Promise<void>;
  readonly afterPageLoad: (callback: () => void) => void;
  readonly startTimer: (callback: () => void, milliseconds: number) => () => void;
  readonly whenRecoverable: (callback: () => void) => () => void;
  readonly reportLoadFailure: (cause: unknown) => void;
};

export const LOAD_TIMEOUT_MS = 15_000;

export const RETRY_DELAYS_MS = [1_000, 4_000] as const;

export function createClerkSession({
  currentClerk,
  loadScript,
  afterPageLoad,
  startTimer,
  whenRecoverable,
  reportLoadFailure,
}: ClerkSessionDependencies) {
  const listeners = new Set<() => void>();
  let email: string | null = null;
  let loading: Promise<ClerkHandle> | null = null;
  let initializing: Promise<void> | null = null;
  let stopWatchingRecovery: (() => void) | null = null;
  let reportedLoad: Promise<ClerkHandle> | null = null;
  let scriptAttempts = 0;

  function follow(clerk: ClerkHandle) {
    clerk.addListener(({ user }) => {
      const next = user?.primaryEmailAddress?.emailAddress ?? null;

      if (next === email) return;

      email = next;

      for (const listener of listeners) listener();
    });

    return clerk;
  }

  function wait(milliseconds: number) {
    return new Promise<void>((resolve) => {
      startTimer(resolve, milliseconds);
    });
  }

  function withinTimeout<T>(work: (abort: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController();

    return new Promise<T>((resolve, reject) => {
      const cancelTimeout = startTimer(() => {
        controller.abort();
        reject(new Error("Timed out loading Clerk"));
      }, LOAD_TIMEOUT_MS);

      work(controller.signal).then(resolve, reject).finally(cancelTimeout);
    });
  }

  function initialize(clerk: ClerkHandle) {
    initializing ??= clerk.load().catch((error: unknown) => {
      initializing = null;
      throw error;
    });

    return initializing;
  }

  async function loadClerkOnce(abort: AbortSignal) {
    if (currentClerk() === undefined) {
      scriptAttempts += 1;
      await loadScript(scriptAttempts, abort);
    }

    const clerk = currentClerk();

    if (clerk === undefined) throw new Error("clerk-js loaded without defining window.Clerk");

    if (!clerk.loaded) await initialize(clerk);

    return clerk;
  }

  async function loadClerk(): Promise<ClerkHandle> {
    for (const delay of RETRY_DELAYS_MS) {
      try {
        return follow(await withinTimeout(loadClerkOnce));
      } catch {
        await wait(delay);
      }
    }

    return follow(await withinTimeout(loadClerkOnce));
  }

  function load() {
    loading ??= loadClerk().catch((error: unknown) => {
      loading = null;
      throw error;
    });

    return loading;
  }

  function start() {
    const attempt = load();

    if (attempt === reportedLoad) return;

    reportedLoad = attempt;
    attempt.then(
      () => {
        stopWatchingRecovery?.();
        stopWatchingRecovery = null;
      },
      (error: unknown) => {
        reportLoadFailure(error);
        stopWatchingRecovery ??= whenRecoverable(start);
      },
    );
  }

  return {
    email: () => email,
    subscribe: (listener: () => void) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    loadAfterPage: () => {
      if (currentClerk()?.loaded) start();
      else afterPageLoad(start);
    },
    signOut: async (redirectUrl: string, onSignedOut: () => void) => {
      const clerk = await withinTimeout(load);
      await clerk.signOut({ redirectUrl });
      onSignedOut();
    },
  };
}

function afterPageLoad(callback: () => void) {
  const whenIdle = () => {
    if ("requestIdleCallback" in window) requestIdleCallback(callback, { timeout: 2000 });
    else setTimeout(callback, 0);
  };

  if (document.readyState === "complete") whenIdle();
  else window.addEventListener("load", whenIdle, { once: true });
}

export function clerkScriptUrl(publishableKey: string) {
  const frontendApi = atob(publishableKey.split("_")[2] ?? "").slice(0, -1);

  return `https://${frontendApi}/npm/@clerk/clerk-js@6/dist/clerk.browser.js`;
}

function loadClerkScript(publishableKey: string, attempt: number, abort: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    const url = clerkScriptUrl(publishableKey);
    script.src = attempt === 1 ? url : `${url}?attempt=${attempt}`;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.dataset.clerkJsScript = "";
    script.dataset.clerkPublishableKey = publishableKey;

    const fail = (reason: string) => {
      script.remove();
      reject(new Error(`${reason} ${script.src}`));
    };

    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => fail("Failed to load"), { once: true });
    abort.addEventListener("abort", () => fail("Timed out loading"), { once: true });
    document.body.append(script);
  });
}

function whenRecoverable(callback: () => void) {
  const onVisible = () => {
    if (document.visibilityState === "visible") callback();
  };

  window.addEventListener("online", callback);
  document.addEventListener("visibilitychange", onVisible);

  return () => {
    window.removeEventListener("online", callback);
    document.removeEventListener("visibilitychange", onVisible);
  };
}

export const clerkSession = createClerkSession({
  currentClerk: () => window.Clerk,
  loadScript: (attempt, abort) =>
    loadClerkScript(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "", attempt, abort),
  afterPageLoad,
  startTimer: (callback, milliseconds) => {
    const timer = setTimeout(callback, milliseconds);

    return () => clearTimeout(timer);
  },
  whenRecoverable,
  reportLoadFailure: (cause: unknown) => {
    console.error(cause);
  },
});
