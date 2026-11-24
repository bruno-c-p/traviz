const CLERK_WAIT_MS = 5_000;

function clerkScriptUrl(publishableKey: string): string {
  const frontendApi = atob(publishableKey.split("_")[2] ?? "").slice(0, -1);

  return `https://${frontendApi}/npm/@clerk/clerk-js@6/dist/clerk.browser.js`;
}

export function ticketSignInExpression(ticket: string, publishableKey: string): string {
  return `(async () => {
    const loadedWithin = (milliseconds) =>
      new Promise((resolve) => {
        const startedAt = Date.now();
        const check = () => {
          if (window.Clerk?.loaded) resolve(true);
          else if (Date.now() - startedAt > milliseconds) resolve(false);
          else setTimeout(check, 100);
        };
        check();
      });

    if (!(await loadedWithin(${CLERK_WAIT_MS}))) {
      if (!window.Clerk)
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = ${JSON.stringify(clerkScriptUrl(publishableKey))};
          script.async = true;
          script.crossOrigin = "anonymous";
          script.dataset.clerkPublishableKey = ${JSON.stringify(publishableKey)};
          script.addEventListener("load", resolve);
          script.addEventListener("error", () => reject(new Error("clerk-js failed to load")));
          document.body.append(script);
        });

      await window.Clerk.load();
    }

    const attempt = await window.Clerk.client.signIn.create({ strategy: "ticket", ticket: ${JSON.stringify(ticket)} });

    await window.Clerk.setActive({ session: attempt.createdSessionId });

    return true;
  })()`;
}
