import { expect, test } from "bun:test";
import { createAccountSection } from "@/features/auth/account-section";
import type { AccountSectionView } from "@/features/auth/account-section";

function createHarness() {
  const views: AccountSectionView[] = [];
  let finish: () => void = () => {};
  let fail: (error: Error) => void = () => {};
  let signOutCalls = 0;

  const section = createAccountSection({
    signOut: () => {
      signOutCalls += 1;

      return new Promise<void>((resolve, reject) => {
        finish = resolve;
        fail = reject;
      });
    },
    show: (view) => {
      views.push(view);
    },
  });

  return {
    section,
    views,
    signOutCalls: () => signOutCalls,
    finish: () => finish(),
    fail: (error: Error) => fail(error),
  };
}

test("signing out shows the pending state and keeps it once Clerk has signed out", async () => {
  const harness = createHarness();
  const signingOut = harness.section.signOut();

  expect(harness.section.view()).toEqual({ isSigningOut: true, signOutFailed: false });

  harness.finish();
  await signingOut;

  expect(harness.views).toEqual([{ isSigningOut: true, signOutFailed: false }]);
});

test("a second tap while signing out does not call Clerk again", async () => {
  const harness = createHarness();
  const signingOut = harness.section.signOut();

  await harness.section.signOut();
  harness.finish();
  await signingOut;

  expect(harness.signOutCalls()).toBe(1);
});

test("a failed sign-out shows the alert and lets the user try again", async () => {
  const harness = createHarness();
  const failing = harness.section.signOut();

  harness.fail(new Error("offline"));
  await failing;

  expect(harness.section.view()).toEqual({ isSigningOut: false, signOutFailed: true });

  const retrying = harness.section.signOut();

  expect(harness.section.view()).toEqual({ isSigningOut: true, signOutFailed: false });

  harness.finish();
  await retrying;

  expect(harness.signOutCalls()).toBe(2);
});

test("closing the menu forgets a failed sign-out", async () => {
  const harness = createHarness();
  const failing = harness.section.signOut();

  harness.fail(new Error("offline"));
  await failing;
  harness.section.forgetFailure();

  expect(harness.section.view()).toEqual({ isSigningOut: false, signOutFailed: false });
});

test("closing the menu while signing out keeps the pending state", () => {
  const harness = createHarness();

  void harness.section.signOut();
  harness.section.forgetFailure();

  expect(harness.section.view()).toEqual({ isSigningOut: true, signOutFailed: false });
});
