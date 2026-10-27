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
  readonly loadScript: () => Promise<void>;
  readonly afterPageLoad: (callback: () => void) => void;
  readonly reportLoadFailure: (cause: unknown) => void;
};

export function createClerkSession({
  currentClerk,
  loadScript,
  afterPageLoad,
  reportLoadFailure,
}: ClerkSessionDependencies) {
  const listeners = new Set<() => void>();
  let email: string | null = null;
  let loading: Promise<ClerkHandle> | null = null;

  function follow(clerk: ClerkHandle) {
    clerk.addListener(({ user }) => {
      const next = user?.primaryEmailAddress?.emailAddress ?? null;

      if (next === email) return;

      email = next;

      for (const listener of listeners) listener();
    });

    return clerk;
  }

  async function loadClerk() {
    if (currentClerk() === undefined) await loadScript();

    const clerk = currentClerk();

    if (clerk === undefined) throw new Error("clerk-js loaded without defining window.Clerk");

    if (!clerk.loaded) await clerk.load();

    return follow(clerk);
  }

  function load() {
    loading ??= loadClerk().catch((error: unknown) => {
      loading = null;
      throw error;
    });

    return loading;
  }

  function start() {
    load().catch(reportLoadFailure);
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

function loadClerkScript(publishableKey: string) {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = clerkScriptUrl(publishableKey);
    script.async = true;
    script.crossOrigin = "anonymous";
    script.dataset.clerkJsScript = "";
    script.dataset.clerkPublishableKey = publishableKey;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener(
      "error",
      () => {
        script.remove();
        reject(new Error(`Failed to load ${script.src}`));
      },
      { once: true },
    );
    document.body.append(script);
  });
}

export const clerkSession = createClerkSession({
  currentClerk: () => window.Clerk,
  loadScript: () => loadClerkScript(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? ""),
  afterPageLoad,
  reportLoadFailure: (cause: unknown) => {
    console.error(cause);
  },
});
