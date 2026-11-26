import { describe, expect, test } from "bun:test";
import {
  CHALLENGED_SIGN_UP_ERROR,
  GENERIC_ERROR,
  MISSING_EMAIL_ERROR,
  WRONG_PASSWORD_ERROR,
  createPasswordSignIn,
} from "@/features/auth/password-sign-in";
import type { DecorateUrl, FlowError, SignInView } from "@/features/auth/password-sign-in";

const EMAIL = "ada@example.com";
const PASSWORD = "correct horse battery";

function apiError(code: string, message: string, paramName?: string): FlowError {
  return { message, errors: [{ code, message, meta: { paramName } }] };
}

const UNKNOWN_EMAIL = apiError(
  "form_identifier_not_found",
  "Couldn't find your account.",
  "identifier",
);

const NO_PASSWORD = apiError("strategy_for_user_invalid", "Not valid for this account");

const WRONG_PASSWORD = apiError("form_password_incorrect", "Password is incorrect.", "password");

const WRONG_CODE = apiError("form_code_incorrect", "Incorrect code", "code");

const SHORT_PASSWORD = apiError("form_password_length_too_short", "Too short.", "password");

type Reply = {
  readonly error?: FlowError;
  readonly signInStatus?: string;
  readonly signUpStatus?: string;
  readonly missingFields?: readonly string[];
};

function createGate() {
  let open = () => {};

  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });

  return { opened, open };
}

function createHarness() {
  const calls: string[] = [];
  const views: SignInView[] = [];
  const destinations: string[] = [];
  const replies = new Map<string, Reply>();
  const gates = new Map<string, ReturnType<typeof createGate>>();
  const decorateUrl: DecorateUrl = (url) => `decorated:${url}`;
  let signInStatus: string | null = "needs_identifier";
  let signUpStatus: string | null = "missing_requirements";
  let missingFields: readonly string[] = [];
  let loadFailure: Error | null = null;

  const answer = async (name: string, detail = "") => {
    calls.push(detail === "" ? name : `${name} ${detail}`);
    await gates.get(name)?.opened;

    const reply = replies.get(name) ?? {};

    signInStatus = reply.signInStatus ?? signInStatus;
    signUpStatus = reply.signUpStatus ?? signUpStatus;
    missingFields = reply.missingFields ?? missingFields;

    return { error: reply.error ?? null };
  };

  const finalize = (name: string) => {
    return async (options: {
      readonly navigate: (target: { decorateUrl: DecorateUrl }) => void;
    }) => {
      const outcome = await answer(name);

      if (outcome.error === null) options.navigate({ decorateUrl });

      return outcome;
    };
  };

  const signIn = {
    get status() {
      return signInStatus;
    },
    password: (credentials: { readonly emailAddress: string; readonly password: string }) =>
      answer("signIn.password", `${credentials.emailAddress} ${credentials.password}`),
    create: (account: { readonly identifier: string }) =>
      answer("signIn.create", account.identifier),
    mfa: {
      sendEmailCode: () => answer("signIn.mfa.sendEmailCode"),
      verifyEmailCode: (entry: { readonly code: string }) =>
        answer("signIn.mfa.verifyEmailCode", entry.code),
    },
    resetPasswordEmailCode: {
      sendCode: () => answer("signIn.reset.sendCode"),
      verifyCode: (entry: { readonly code: string }) =>
        answer("signIn.reset.verifyCode", entry.code),
      submitPassword: (choice: {
        readonly password: string;
        readonly signOutOfOtherSessions: boolean;
      }) =>
        answer(
          "signIn.reset.submitPassword",
          `${choice.password} ${String(choice.signOutOfOtherSessions)}`,
        ),
    },
    finalize: finalize("signIn.finalize"),
  };

  const signUp = {
    get status() {
      return signUpStatus;
    },
    get missingFields() {
      return missingFields;
    },
    password: (credentials: { readonly emailAddress: string; readonly password: string }) =>
      answer("signUp.password", `${credentials.emailAddress} ${credentials.password}`),
    verifications: {
      sendEmailCode: () => answer("signUp.sendEmailCode"),
      verifyEmailCode: (entry: { readonly code: string }) =>
        answer("signUp.verifyEmailCode", entry.code),
    },
    finalize: finalize("signUp.finalize"),
  };

  const flow = createPasswordSignIn({
    loadAttempts: () =>
      loadFailure === null ? Promise.resolve({ signIn, signUp }) : Promise.reject(loadFailure),
    goHome: (decorate) => {
      destinations.push(decorate("/"));
    },
    show: (view) => {
      views.push(view);
    },
  });

  return {
    flow,
    calls,
    views,
    destinations,
    reply: (name: string, reply: Reply) => {
      replies.set(name, reply);
    },
    hold: (name: string) => {
      const gate = createGate();

      gates.set(name, gate);

      return gate.open;
    },
    failLoad: (error: Error) => {
      loadFailure = error;
    },
  };
}

describe("signing in", () => {
  test("a known device goes home through Clerk's decorated URL", async () => {
    const harness = createHarness();

    harness.reply("signIn.password", { signInStatus: "complete" });
    await harness.flow.submitCredentials(EMAIL, PASSWORD);

    expect(harness.calls).toEqual([`signIn.password ${EMAIL} ${PASSWORD}`, "signIn.finalize"]);
    expect(harness.destinations).toEqual(["decorated:/"]);
    expect(harness.flow.view()).toMatchObject({ step: "credentials", isBusy: true });
  });

  test("the form is busy while Clerk answers and ignores a second submit", async () => {
    const harness = createHarness();
    const release = harness.hold("signIn.password");

    harness.reply("signIn.password", { error: WRONG_PASSWORD });

    const first = harness.flow.submitCredentials(EMAIL, PASSWORD);

    expect(harness.flow.view()).toMatchObject({ isBusy: true, emailAddress: EMAIL });

    await harness.flow.submitCredentials(EMAIL, "another password!");
    release();
    await first;

    expect(harness.calls).toEqual([`signIn.password ${EMAIL} ${PASSWORD}`]);
    expect(harness.flow.view()).toMatchObject({ isBusy: false });
  });

  test("a wrong password shows on the password field with the app's own text", async () => {
    const harness = createHarness();

    harness.reply("signIn.password", { error: WRONG_PASSWORD });
    await harness.flow.submitCredentials(EMAIL, PASSWORD);

    expect(harness.flow.view()).toMatchObject({
      step: "credentials",
      errorMessage: WRONG_PASSWORD_ERROR,
      errorField: "password",
    });
    expect(harness.destinations).toEqual([]);
  });

  test("a new device asks for an emailed code, then goes home", async () => {
    const harness = createHarness();

    harness.reply("signIn.password", { signInStatus: "needs_client_trust" });
    await harness.flow.submitCredentials(EMAIL, PASSWORD);

    expect(harness.flow.view()).toMatchObject({ step: "code", codePurpose: "new-device" });

    harness.reply("signIn.mfa.verifyEmailCode", { signInStatus: "complete" });
    await harness.flow.submitCode("424242");

    expect(harness.calls).toEqual([
      `signIn.password ${EMAIL} ${PASSWORD}`,
      "signIn.mfa.sendEmailCode",
      "signIn.mfa.verifyEmailCode 424242",
      "signIn.finalize",
    ]);
    expect(harness.destinations).toEqual(["decorated:/"]);
  });

  test("a wrong code stays on the code step and shows on the code field", async () => {
    const harness = createHarness();

    harness.reply("signIn.password", { signInStatus: "needs_client_trust" });
    await harness.flow.submitCredentials(EMAIL, PASSWORD);
    harness.reply("signIn.mfa.verifyEmailCode", { error: WRONG_CODE });
    await harness.flow.submitCode("111111");

    expect(harness.flow.view()).toMatchObject({
      step: "code",
      errorMessage: "Incorrect code",
      errorField: "code",
      isBusy: false,
    });
  });

  test("a status the form cannot continue from shows the generic error", async () => {
    const harness = createHarness();

    harness.reply("signIn.password", { signInStatus: "needs_first_factor" });
    await harness.flow.submitCredentials(EMAIL, PASSWORD);

    expect(harness.flow.view()).toMatchObject({ step: "credentials", errorMessage: GENERIC_ERROR });
  });

  test("a failed finalize shows its error and stays", async () => {
    const harness = createHarness();

    harness.reply("signIn.password", { signInStatus: "complete" });
    harness.reply("signIn.finalize", { error: { message: "offline" } });
    await harness.flow.submitCredentials(EMAIL, PASSWORD);

    expect(harness.destinations).toEqual([]);
    expect(harness.flow.view()).toMatchObject({ errorMessage: GENERIC_ERROR, isBusy: false });
  });

  test("clerk-js that cannot load shows the generic error", async () => {
    const harness = createHarness();

    harness.failLoad(new Error("Timed out loading Clerk"));
    await harness.flow.submitCredentials(EMAIL, PASSWORD);

    expect(harness.calls).toEqual([]);
    expect(harness.flow.view()).toMatchObject({ errorMessage: GENERIC_ERROR, isBusy: false });
  });
});

describe("signing up", () => {
  test("an unknown email creates the account and confirms the address by code", async () => {
    const harness = createHarness();

    harness.reply("signIn.password", { error: UNKNOWN_EMAIL });
    await harness.flow.submitCredentials(EMAIL, PASSWORD);

    expect(harness.flow.view()).toMatchObject({
      step: "code",
      codePurpose: "sign-up",
      emailAddress: EMAIL,
      errorMessage: null,
    });

    harness.reply("signUp.verifyEmailCode", { signUpStatus: "complete" });
    await harness.flow.submitCode("424242");

    expect(harness.calls).toEqual([
      `signIn.password ${EMAIL} ${PASSWORD}`,
      `signUp.password ${EMAIL} ${PASSWORD}`,
      "signUp.sendEmailCode",
      "signUp.verifyEmailCode 424242",
      "signUp.finalize",
    ]);
    expect(harness.destinations).toEqual(["decorated:/"]);
  });

  test("a password Clerk refuses shows on the password field", async () => {
    const harness = createHarness();

    harness.reply("signIn.password", { error: UNKNOWN_EMAIL });
    harness.reply("signUp.password", { error: SHORT_PASSWORD });
    await harness.flow.submitCredentials(EMAIL, "short");

    expect(harness.flow.view()).toMatchObject({
      step: "credentials",
      errorMessage: "Too short.",
      errorField: "password",
    });
  });

  test("a sign-up Clerk Protect challenges says so before any code is sent", async () => {
    const harness = createHarness();

    harness.reply("signIn.password", { error: UNKNOWN_EMAIL });
    harness.reply("signUp.password", { missingFields: ["protect_check"] });
    await harness.flow.submitCredentials(EMAIL, PASSWORD);

    expect(harness.calls).not.toContain("signUp.sendEmailCode");
    expect(harness.flow.view()).toMatchObject({
      step: "credentials",
      errorMessage: CHALLENGED_SIGN_UP_ERROR,
    });
  });

  test("a sign-up that is still incomplete after the code shows the generic error", async () => {
    const harness = createHarness();

    harness.reply("signIn.password", { error: UNKNOWN_EMAIL });
    await harness.flow.submitCredentials(EMAIL, PASSWORD);
    await harness.flow.submitCode("424242");

    expect(harness.calls).not.toContain("signUp.finalize");
    expect(harness.flow.view()).toMatchObject({ step: "code", errorMessage: GENERIC_ERROR });
  });
});

describe("resetting the password", () => {
  test("forgot password sends a code, takes a new password and signs in", async () => {
    const harness = createHarness();

    await harness.flow.forgotPassword(EMAIL);

    expect(harness.flow.view()).toMatchObject({
      step: "code",
      codePurpose: "reset",
      emailAddress: EMAIL,
    });

    harness.reply("signIn.reset.verifyCode", { signInStatus: "needs_new_password" });
    await harness.flow.submitCode("424242");

    expect(harness.flow.view()).toMatchObject({ step: "new-password", errorMessage: null });

    harness.reply("signIn.reset.submitPassword", { signInStatus: "complete" });
    await harness.flow.submitNewPassword(PASSWORD);

    expect(harness.calls).toEqual([
      `signIn.create ${EMAIL}`,
      "signIn.reset.sendCode",
      "signIn.reset.verifyCode 424242",
      `signIn.reset.submitPassword ${PASSWORD} true`,
      "signIn.finalize",
    ]);
    expect(harness.destinations).toEqual(["decorated:/"]);
  });

  test("forgot password with no email asks for it and calls nothing", async () => {
    const harness = createHarness();

    await harness.flow.forgotPassword("  ");

    expect(harness.calls).toEqual([]);
    expect(harness.flow.view()).toMatchObject({
      step: "credentials",
      errorMessage: MISSING_EMAIL_ERROR,
      errorField: "email",
    });
  });

  test("forgot password for an unknown email shows Clerk's message on the email field", async () => {
    const harness = createHarness();

    harness.reply("signIn.create", { error: UNKNOWN_EMAIL });
    await harness.flow.forgotPassword(EMAIL);

    expect(harness.calls).toEqual([`signIn.create ${EMAIL}`]);
    expect(harness.flow.view()).toMatchObject({
      step: "credentials",
      errorMessage: "Couldn't find your account.",
      errorField: "email",
    });
  });

  test("an account with no password is sent a code to set one", async () => {
    const harness = createHarness();

    harness.reply("signIn.password", { error: NO_PASSWORD });
    await harness.flow.submitCredentials(EMAIL, PASSWORD);

    expect(harness.calls).toEqual([
      `signIn.password ${EMAIL} ${PASSWORD}`,
      `signIn.create ${EMAIL}`,
      "signIn.reset.sendCode",
    ]);
    expect(harness.flow.view()).toMatchObject({
      step: "code",
      codePurpose: "set-password",
      errorMessage: null,
    });
  });

  test("a new password Clerk refuses stays on the password step", async () => {
    const harness = createHarness();

    await harness.flow.forgotPassword(EMAIL);
    harness.reply("signIn.reset.verifyCode", { signInStatus: "needs_new_password" });
    await harness.flow.submitCode("424242");
    harness.reply("signIn.reset.submitPassword", { error: SHORT_PASSWORD });
    await harness.flow.submitNewPassword("short");

    expect(harness.flow.view()).toMatchObject({
      step: "new-password",
      errorMessage: "Too short.",
      errorField: "password",
    });
  });

  test("a reset on a new device still asks for the device code", async () => {
    const harness = createHarness();

    await harness.flow.forgotPassword(EMAIL);
    harness.reply("signIn.reset.verifyCode", { signInStatus: "needs_new_password" });
    await harness.flow.submitCode("424242");
    harness.reply("signIn.reset.submitPassword", { signInStatus: "needs_client_trust" });
    await harness.flow.submitNewPassword(PASSWORD);

    expect(harness.calls.at(-1)).toBe("signIn.mfa.sendEmailCode");
    expect(harness.flow.view()).toMatchObject({ step: "code", codePurpose: "new-device" });
  });
});

describe("the code step", () => {
  test("resending uses the sender of the code's purpose and says so", async () => {
    const harness = createHarness();

    harness.reply("signIn.password", { error: UNKNOWN_EMAIL });
    await harness.flow.submitCredentials(EMAIL, PASSWORD);
    await harness.flow.resendCode();

    expect(harness.calls.filter((call) => call === "signUp.sendEmailCode")).toHaveLength(2);
    expect(harness.flow.view()).toMatchObject({ step: "code", wasCodeResent: true });

    harness.reply("signUp.verifyEmailCode", { error: WRONG_CODE });
    await harness.flow.submitCode("111111");

    expect(harness.flow.view()).toMatchObject({ wasCodeResent: false });
  });

  test("a failed resend shows its error and does not claim a new code", async () => {
    const harness = createHarness();

    await harness.flow.forgotPassword(EMAIL);
    harness.reply("signIn.reset.sendCode", { error: apiError("too_many_requests", "Slow down.") });
    await harness.flow.resendCode();

    expect(harness.flow.view()).toMatchObject({
      step: "code",
      wasCodeResent: false,
      errorMessage: "Slow down.",
      errorField: null,
    });
  });

  test("restart returns to the credentials and clears the error", async () => {
    const harness = createHarness();

    await harness.flow.forgotPassword(EMAIL);
    harness.reply("signIn.reset.verifyCode", { error: WRONG_CODE });
    await harness.flow.submitCode("111111");
    harness.flow.restart();

    expect(harness.flow.view()).toMatchObject({
      step: "credentials",
      errorMessage: null,
      errorField: null,
      emailAddress: EMAIL,
    });
  });

  test("an action for another step does nothing", async () => {
    const harness = createHarness();

    await harness.flow.submitCode("424242");
    await harness.flow.submitNewPassword(PASSWORD);
    await harness.flow.resendCode();

    expect(harness.calls).toEqual([]);
    expect(harness.views).toEqual([]);
  });
});
