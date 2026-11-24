import { expect, test } from "bun:test";
import { createDangerZone } from "@/features/marks/danger-zone";
import type { DangerZoneView } from "@/features/marks/danger-zone";

function createHarness() {
  const views: DangerZoneView[] = [];
  let resets = 0;

  const dangerZone = createDangerZone({
    resetAll: () => {
      resets += 1;
    },
    show: (view) => {
      views.push(view);
    },
  });

  return { dangerZone, views, resets: () => resets };
}

test("starts with no confirmation and no reset message", () => {
  expect(createHarness().dangerZone.view()).toEqual({ isConfirming: false, isResetDone: false });
});

test("asking to reset shows the confirmation and resets nothing", () => {
  const harness = createHarness();

  harness.dangerZone.askToReset();

  expect(harness.views).toEqual([{ isConfirming: true, isResetDone: false }]);
  expect(harness.resets()).toBe(0);
});

test("cancelling hides the confirmation and resets nothing", () => {
  const harness = createHarness();

  harness.dangerZone.askToReset();
  harness.dangerZone.cancel();

  expect(harness.dangerZone.view()).toEqual({ isConfirming: false, isResetDone: false });
  expect(harness.resets()).toBe(0);
});

test("confirming resets every mark once and says so", () => {
  const harness = createHarness();

  harness.dangerZone.askToReset();
  harness.dangerZone.confirmReset();

  expect(harness.resets()).toBe(1);
  expect(harness.dangerZone.view()).toEqual({ isConfirming: false, isResetDone: true });
});

test("confirming without the confirmation step does nothing", () => {
  const harness = createHarness();

  harness.dangerZone.confirmReset();

  expect(harness.resets()).toBe(0);
  expect(harness.views).toEqual([]);
});

test("asking again clears the reset message", () => {
  const harness = createHarness();

  harness.dangerZone.askToReset();
  harness.dangerZone.confirmReset();
  harness.dangerZone.askToReset();

  expect(harness.dangerZone.view()).toEqual({ isConfirming: true, isResetDone: false });
});

test("closing the menu forgets the confirmation and the reset message", () => {
  const harness = createHarness();

  harness.dangerZone.askToReset();
  harness.dangerZone.confirmReset();
  harness.dangerZone.forget();

  expect(harness.dangerZone.view()).toEqual({ isConfirming: false, isResetDone: false });
});
