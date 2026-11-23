import { expect, test } from "bun:test";
import { EXIT_TIMEOUT_MS, afterExit } from "@/features/globe/sheet-exit";

function createFakeTimers() {
  const timers = new Map<number, { callback: () => void; delayMs: number }>();
  let nextTimerId = 1;

  return {
    setTimeout: (callback: () => void, delayMs: number) => {
      const timerId = nextTimerId++;

      timers.set(timerId, { callback, delayMs });

      return timerId;
    },
    clearTimeout: (timerId: number) => {
      timers.delete(timerId);
    },
    run: () => {
      const pending = [...timers.values()];

      timers.clear();

      for (const timer of pending) timer.callback();
    },
    delays: () => [...timers.values()].map((timer) => timer.delayMs),
  };
}

function createExit() {
  const animation = Promise.withResolvers<string>();
  const timers = createFakeTimers();
  let ends = 0;

  afterExit(animation.promise, timers, () => {
    ends += 1;
  });

  return { animation, timers, ends: () => ends };
}

test("removes the sheet when the exit animation finishes, and drops the timer", async () => {
  const exit = createExit();

  exit.animation.resolve("finished");
  await exit.animation.promise;

  expect(exit.ends()).toBe(1);
  expect(exit.timers.delays()).toEqual([]);
});

test("removes the sheet when the exit animation is cancelled", async () => {
  const exit = createExit();

  exit.animation.reject(new Error("The animation was cancelled."));
  await exit.animation.promise.catch(() => "cancelled");

  expect(exit.ends()).toBe(1);
});

test("removes the sheet after the timeout when the animation never settles", () => {
  const exit = createExit();

  expect(exit.ends()).toBe(0);
  expect(exit.timers.delays()).toEqual([EXIT_TIMEOUT_MS]);

  exit.timers.run();

  expect(exit.ends()).toBe(1);
});

test("removes the sheet once when the animation settles after the timeout", async () => {
  const exit = createExit();

  exit.timers.run();
  exit.animation.resolve("finished");
  await exit.animation.promise;

  expect(exit.ends()).toBe(1);
});
