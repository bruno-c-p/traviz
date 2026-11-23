import { expect, test } from "bun:test";
import { STALE_AFTER_MS, reloadWhenStale } from "@/features/app-shell/resume-reload";

function createApp(startsVisible = true) {
  const listeners = new Set<() => void>();
  let time = 0;
  let visible = startsVisible;
  let online = true;
  let reloads = 0;

  const stop = reloadWhenStale({
    now: () => time,
    isVisible: () => visible,
    isOnline: () => online,
    onVisibilityChange: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    reload: () => {
      reloads += 1;
    },
  });

  function show(isShown: boolean) {
    visible = isShown;

    for (const listener of listeners) listener();
  }

  return {
    stop,
    hide: () => show(false),
    show: () => show(true),
    wait: (milliseconds: number) => {
      time += milliseconds;
    },
    goOffline: () => {
      online = false;
    },
    reloads: () => reloads,
  };
}

test("reloads when the app comes back after a long time in the background", () => {
  const app = createApp();

  app.hide();
  app.wait(STALE_AFTER_MS);
  app.show();

  expect(app.reloads()).toBe(1);
});

test("keeps the page when the app comes back sooner", () => {
  const app = createApp();

  app.hide();
  app.wait(STALE_AFTER_MS - 1);
  app.show();

  expect(app.reloads()).toBe(0);
});

test("counts each time in the background on its own", () => {
  const app = createApp();

  app.hide();
  app.wait(STALE_AFTER_MS - 1);
  app.show();
  app.wait(STALE_AFTER_MS);
  app.hide();
  app.wait(1);
  app.show();

  expect(app.reloads()).toBe(0);
});

test("measures from the first hidden event when the page reports hidden twice", () => {
  const app = createApp();

  app.hide();
  app.wait(STALE_AFTER_MS - 1);
  app.hide();
  app.wait(1);
  app.show();

  expect(app.reloads()).toBe(1);
});

test("keeps the page when it is offline, because a reload would lose it", () => {
  const app = createApp();

  app.hide();
  app.goOffline();
  app.wait(STALE_AFTER_MS);
  app.show();

  expect(app.reloads()).toBe(0);
});

test("counts from the start for a page that loads in the background", () => {
  const app = createApp(false);

  app.wait(STALE_AFTER_MS);
  app.show();

  expect(app.reloads()).toBe(1);
});

test("stops watching when it is stopped", () => {
  const app = createApp();

  app.stop();
  app.hide();
  app.wait(STALE_AFTER_MS);
  app.show();

  expect(app.reloads()).toBe(0);
});
