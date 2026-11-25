import { describe, expect, test } from "bun:test";
import {
  VERIFICATION_MESSAGES,
  canRetry,
  failureStatus,
  verifyEmailLink,
} from "@/features/auth/email-link-verification";
import type { VerificationStatus } from "@/features/auth/email-link-verification";

class FakeLinkError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

const failureOf = (cause: unknown) => ({
  code: cause instanceof FakeLinkError ? cause.code : null,
});

async function statusesAfter(verify: (onOtherDevice: () => void) => Promise<void>) {
  const statuses: VerificationStatus[] = [];

  await verifyEmailLink({ verify, failureOf, show: (status) => statuses.push(status) });

  return statuses;
}

describe("verifying an email link", () => {
  test("checks first, then reports the link verified", async () => {
    expect(await statusesAfter(() => Promise.resolve())).toEqual(["checking", "verified"]);
  });

  test("a link opened on another device is verified", async () => {
    const statuses = await statusesAfter((onOtherDevice) => {
      onOtherDevice();

      return Promise.resolve();
    });

    expect(statuses).toEqual(["checking", "verified", "verified"]);
  });

  test("an expired link is expired", async () => {
    const statuses = await statusesAfter(() => Promise.reject(new FakeLinkError("expired")));

    expect(statuses).toEqual(["checking", "expired"]);
  });

  test("a link opened in another browser is a client mismatch", async () => {
    const statuses = await statusesAfter(() =>
      Promise.reject(new FakeLinkError("client_mismatch")),
    );

    expect(statuses).toEqual(["checking", "client_mismatch"]);
  });

  test("any other failure, such as Clerk not loading, is failed", async () => {
    expect(await statusesAfter(() => Promise.reject(new FakeLinkError("failed")))).toEqual([
      "checking",
      "failed",
    ]);
    expect(await statusesAfter(() => Promise.reject(new Error("offline")))).toEqual([
      "checking",
      "failed",
    ]);
  });
});

test("only a failed check offers a new link", () => {
  expect(canRetry("checking")).toBe(false);
  expect(canRetry("verified")).toBe(false);
  expect(canRetry("expired")).toBe(true);
  expect(canRetry("failed")).toBe(true);
  expect(canRetry("client_mismatch")).toBe(true);
});

test("an unknown code is a failed link", () => {
  expect(failureStatus({ code: "something_new" })).toBe("failed");
  expect(failureStatus({ code: null })).toBe("failed");
});

test("every status has a title and a body", () => {
  for (const { title, body } of Object.values(VERIFICATION_MESSAGES)) {
    expect(title.length).toBeGreaterThan(0);
    expect(body.length).toBeGreaterThan(0);
  }
});
