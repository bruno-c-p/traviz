import { describe, expect, test } from "bun:test";
import { GENERIC_ERROR, createEmailLinkSignIn } from "@/features/auth/email-link-sign-in";
import type { DecorateUrl, EmailLinkView, FlowError } from "@/features/auth/email-link-sign-in";

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const VERIFICATION_URL = "https://traviz.example/sign-in/verify";

const UNKNOWN_EMAIL: FlowError = {
  message: "Couldn't find your account.",
  errors: [{ code: "form_identifier_not_found", message: "Couldn't find your account." }],
};

type Outcome = { readonly error: FlowError | null };

const OK: Outcome = { error: null };

function createGate() {
  let open: (outcome: Outcome) => void = () => {};

  const outcome = new Promise<Outcome>((resolve) => {
    open = resolve;
  });

  return { outcome, open };
}

function createHarness() {
  const calls: string[] = [];
  const views: EmailLinkView[] = [];
  const destinations: string[] = [];
  const signInWaits: ReturnType<typeof createGate>[] = [];
  const signUpWait = createGate();
  const decorateUrl: DecorateUrl = (url) => `decorated:${url}`;
  let signInSend: Outcome = OK;
  let signUpCreate: Outcome = OK;
  let signUpSend: Outcome = OK;
  let finalizeOutcome: Outcome = OK;
  let signInStatus: string | null = "needs_first_factor";
  let signUpStatus: string | null = "missing_requirements";
  let loadFailure: Error | null = null;

  const finalize = (name: string) => {
    return (options: { readonly navigate: (target: { decorateUrl: DecorateUrl }) => void }) => {
      calls.push(`${name}.finalize`);

      if (finalizeOutcome.error === null) options.navigate({ decorateUrl });

      return Promise.resolve(finalizeOutcome);
    };
  };

  const signIn = {
    get status() {
      return signInStatus;
    },
    emailLink: {
      sendLink: (link: { readonly emailAddress: string; readonly verificationUrl: string }) => {
        calls.push(`signIn.sendLink ${link.emailAddress} ${link.verificationUrl}`);

        return Promise.resolve(signInSend);
      },
      waitForVerification: () => {
        const gate = createGate();

        calls.push("signIn.waitForVerification");
        signInWaits.push(gate);

        return gate.outcome;
      },
    },
    finalize: finalize("signIn"),
  };

  const signUp = {
    get status() {
      return signUpStatus;
    },
    create: (account: { readonly emailAddress: string }) => {
      calls.push(`signUp.create ${account.emailAddress}`);

      return Promise.resolve(signUpCreate);
    },
    verifications: {
      sendEmailLink: (link: { readonly verificationUrl: string }) => {
        calls.push(`signUp.sendEmailLink ${link.verificationUrl}`);

        return Promise.resolve(signUpSend);
      },
      waitForEmailLinkVerification: () => {
        calls.push("signUp.waitForEmailLinkVerification");

        return signUpWait.outcome;
      },
    },
    finalize: finalize("signUp"),
  };

  const flow = createEmailLinkSignIn({
    loadAttempts: () =>
      loadFailure === null ? Promise.resolve({ signIn, signUp }) : Promise.reject(loadFailure),
    verificationUrl: VERIFICATION_URL,
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
    steps: () => views.map((view) => view.step),
    verifySignIn: async (outcome: Outcome = OK) => {
      signInStatus = outcome.error === null ? "complete" : signInStatus;
      signInWaits.at(-1)?.open(outcome);
      await flush();
    },
    finishSignInWait: async (index: number, outcome: Outcome, status: string) => {
      signInStatus = status;
      signInWaits[index]?.open(outcome);
      await flush();
    },
    verifySignUp: async (status: string) => {
      signUpStatus = status;
      signUpWait.open(OK);
      await flush();
    },
    failSignInSend: (error: FlowError) => {
      signInSend = { error };
    },
    failSignUpCreate: (error: FlowError) => {
      signUpCreate = { error };
    },
    failSignUpSend: (error: FlowError) => {
      signUpSend = { error };
    },
    failFinalize: (error: FlowError) => {
      finalizeOutcome = { error };
    },
    failLoad: (error: Error | null) => {
      loadFailure = error;
    },
  };
}

describe("signing in with an email link", () => {
  test("starts on the email step with no error", () => {
    const harness = createHarness();

    expect(harness.flow.view()).toEqual({ step: "email", emailAddress: "", errorMessage: null });
  });

  test("sends the link, shows the sent step and goes home once the link is opened", async () => {
    const harness = createHarness();

    void harness.flow.submit("ada@example.com");
    await flush();

    expect(harness.steps()).toEqual(["sending", "sent"]);
    expect(harness.flow.view().emailAddress).toBe("ada@example.com");
    expect(harness.calls).toEqual([
      `signIn.sendLink ada@example.com ${VERIFICATION_URL}`,
      "signIn.waitForVerification",
    ]);
    expect(harness.destinations).toEqual([]);

    await harness.verifySignIn();

    expect(harness.calls.at(-1)).toBe("signIn.finalize");
    expect(harness.destinations).toEqual(["decorated:/"]);
    expect(harness.flow.view().step).toBe("sent");
  });

  test("shows Clerk's long message when the link cannot be sent", async () => {
    const harness = createHarness();

    harness.failSignInSend({
      message: "is invalid",
      errors: [
        { code: "form_param_format_invalid", message: "is invalid", longMessage: "Bad email." },
      ],
    });
    await harness.flow.submit("ada@");

    expect(harness.steps()).toEqual(["sending", "email"]);
    expect(harness.flow.view().errorMessage).toBe("Bad email.");
    expect(harness.calls).toEqual([`signIn.sendLink ada@ ${VERIFICATION_URL}`]);
  });

  test("falls back to Clerk's short message, then to the generic one", async () => {
    const short = createHarness();
    const bare = createHarness();

    short.failSignInSend({ message: "x", errors: [{ code: "too_many", message: "Slow down." }] });
    bare.failSignInSend({ message: "Network request failed" });
    await short.flow.submit("ada@example.com");
    await bare.flow.submit("ada@example.com");

    expect(short.flow.view().errorMessage).toBe("Slow down.");
    expect(bare.flow.view().errorMessage).toBe(GENERIC_ERROR);
  });

  test("an expired link returns to the email step with the error", async () => {
    const harness = createHarness();

    void harness.flow.submit("ada@example.com");
    await flush();
    await harness.verifySignIn({
      error: { message: "x", errors: [{ code: "expired", message: "The link expired." }] },
    });

    expect(harness.steps()).toEqual(["sending", "sent", "email"]);
    expect(harness.flow.view().errorMessage).toBe("The link expired.");
    expect(harness.destinations).toEqual([]);
  });

  test("a verified link that leaves the sign-in incomplete is an error", async () => {
    const harness = createHarness();

    void harness.flow.submit("ada@example.com");
    await flush();
    await harness.finishSignInWait(0, OK, "needs_second_factor");

    expect(harness.steps()).toEqual(["sending", "sent", "email"]);
    expect(harness.flow.view().errorMessage).toBe(GENERIC_ERROR);
    expect(harness.calls).not.toContain("signIn.finalize");
    expect(harness.destinations).toEqual([]);
  });

  test("a failed finalize returns to the email step", async () => {
    const harness = createHarness();

    harness.failFinalize({ message: "Network request failed" });
    void harness.flow.submit("ada@example.com");
    await flush();
    await harness.verifySignIn();

    expect(harness.flow.view()).toEqual({
      step: "email",
      emailAddress: "ada@example.com",
      errorMessage: GENERIC_ERROR,
    });
    expect(harness.destinations).toEqual([]);
  });

  test("a failure to load Clerk shows the generic error and a later submit tries again", async () => {
    const harness = createHarness();

    harness.failLoad(new Error("Timed out loading Clerk"));
    await harness.flow.submit("ada@example.com");

    expect(harness.flow.view().errorMessage).toBe(GENERIC_ERROR);
    expect(harness.calls).toEqual([]);

    harness.failLoad(null);
    void harness.flow.submit("ada@example.com");
    await flush();

    expect(harness.flow.view()).toEqual({
      step: "sent",
      emailAddress: "ada@example.com",
      errorMessage: null,
    });
  });

  test("a second submit while one is sending is ignored", async () => {
    const harness = createHarness();

    void harness.flow.submit("ada@example.com");
    void harness.flow.submit("grace@example.com");
    await flush();

    expect(harness.calls.filter((call) => call.startsWith("signIn.sendLink"))).toEqual([
      `signIn.sendLink ada@example.com ${VERIFICATION_URL}`,
    ]);
  });
});

describe("an email with no account", () => {
  test("signs up with the same link and goes home once it is opened", async () => {
    const harness = createHarness();

    harness.failSignInSend(UNKNOWN_EMAIL);
    void harness.flow.submit("new@example.com");
    await flush();

    expect(harness.steps()).toEqual(["sending", "sent"]);
    expect(harness.calls).toEqual([
      `signIn.sendLink new@example.com ${VERIFICATION_URL}`,
      "signUp.create new@example.com",
      `signUp.sendEmailLink ${VERIFICATION_URL}`,
      "signUp.waitForEmailLinkVerification",
    ]);

    await harness.verifySignUp("complete");

    expect(harness.calls.at(-1)).toBe("signUp.finalize");
    expect(harness.destinations).toEqual(["decorated:/"]);
  });

  test("shows the error when the account cannot be created", async () => {
    const harness = createHarness();

    harness.failSignInSend(UNKNOWN_EMAIL);
    harness.failSignUpCreate({
      message: "x",
      errors: [{ code: "not_allowed", message: "Sign-ups are closed." }],
    });
    await harness.flow.submit("new@example.com");

    expect(harness.steps()).toEqual(["sending", "email"]);
    expect(harness.flow.view().errorMessage).toBe("Sign-ups are closed.");
  });

  test("shows the error when the sign-up link cannot be sent", async () => {
    const harness = createHarness();

    harness.failSignInSend(UNKNOWN_EMAIL);
    harness.failSignUpSend({ message: "Network request failed" });
    await harness.flow.submit("new@example.com");

    expect(harness.flow.view().errorMessage).toBe(GENERIC_ERROR);
    expect(harness.calls).not.toContain("signUp.waitForEmailLinkVerification");
  });

  test("a verified sign-up that still misses requirements is an error", async () => {
    const harness = createHarness();

    harness.failSignInSend(UNKNOWN_EMAIL);
    void harness.flow.submit("new@example.com");
    await flush();
    await harness.verifySignUp("missing_requirements");

    expect(harness.steps()).toEqual(["sending", "sent", "email"]);
    expect(harness.flow.view().errorMessage).toBe(GENERIC_ERROR);
    expect(harness.calls).not.toContain("signUp.finalize");
    expect(harness.destinations).toEqual([]);
  });
});

describe("using a different email", () => {
  test("returns to the email step and keeps the address", async () => {
    const harness = createHarness();

    void harness.flow.submit("ada@example.com");
    await flush();
    harness.flow.restart();

    expect(harness.flow.view()).toEqual({
      step: "email",
      emailAddress: "ada@example.com",
      errorMessage: null,
    });
  });

  test("an error from the abandoned link does not touch the new attempt", async () => {
    const harness = createHarness();

    void harness.flow.submit("ada@example.com");
    await flush();
    harness.flow.restart();
    void harness.flow.submit("grace@example.com");
    await flush();

    await harness.finishSignInWait(
      0,
      { error: { message: "x", errors: [{ code: "expired", message: "The link expired." }] } },
      "needs_first_factor",
    );

    expect(harness.flow.view()).toEqual({
      step: "sent",
      emailAddress: "grace@example.com",
      errorMessage: null,
    });
  });

  test("the abandoned link still signs in when it is opened after all", async () => {
    const harness = createHarness();

    void harness.flow.submit("ada@example.com");
    await flush();
    harness.flow.restart();
    await harness.verifySignIn();

    expect(harness.destinations).toEqual(["decorated:/"]);
    expect(harness.flow.view().step).toBe("email");
  });
});
