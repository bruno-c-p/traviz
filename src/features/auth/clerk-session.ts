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
  readonly whenRecoverable: (callback: () => void) => void;
  readonly reportLoadFailure: (cause: unknown) => void;
};

export const SCRIPT_TIMEOUT_MS = 15_000;

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
  let watchesRecovery = false;
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

  function loadScriptWithinTimeout() {
    const controller = new AbortController();
    const cancelTimeout = startTimer(() => controller.abort(), SCRIPT_TIMEOUT_MS);
    scriptAttempts += 1;

    return loadScript(scriptAttempts, controller.signal).finally(cancelTimeout);
  }

  async function loadClerkOnce() {
    if (currentClerk() === undefined) await loadScriptWithinTimeout();

    const clerk = currentClerk();

    if (clerk === undefined) throw new Error("clerk-js loaded without defining window.Clerk");

    if (!clerk.loaded) await clerk.load();

    return follow(clerk);
  }

  async function loadClerk(): Promise<ClerkHandle> {
    for (const delay of RETRY_DELAYS_MS) {
      try {
        return await loadClerkOnce();
      } catch {
        await wait(delay);
      }
    }

    return loadClerkOnce();
  }

  function load() {
    loading ??= loadClerk().catch((error: unknown) => {
      loading = null;
      throw error;
    });

    return loading;
  }

  function start() {
    load().catch((error: unknown) => {
      reportLoadFailure(error);

      if (watchesRecovery) return;

      watchesRecovery = true;
      whenRecoverable(start);
    });
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
      const clerk = await load();
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
  window.addEventListener("online", callback);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") callback();
  });
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
