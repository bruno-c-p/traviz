export type SignInStep = "credentials" | "code" | "new-password";

export type CodePurpose = "sign-up" | "new-device" | "reset" | "set-password";

export type SignInField = "email" | "password" | "code";

export type SignInView = {
  readonly step: SignInStep;
  readonly codePurpose: CodePurpose;
  readonly emailAddress: string;
  readonly isBusy: boolean;
  readonly wasCodeResent: boolean;
  readonly errorMessage: string | null;
  readonly errorField: SignInField | null;
};

type ApiProblem = {
  readonly code: string;
  readonly message: string;
  readonly longMessage?: string;
  readonly meta?: { readonly paramName?: string };
};

export type FlowError = {
  readonly message: string;
  readonly errors?: readonly ApiProblem[];
};

type FlowResult = Promise<{ readonly error: FlowError | null }>;

export type DecorateUrl = (url: string) => string;

type Finalize = (options: {
  readonly navigate: (target: { readonly decorateUrl: DecorateUrl }) => void;
}) => FlowResult;

type Credentials = { readonly emailAddress: string; readonly password: string };

type CodeEntry = { readonly code: string };

export type SignInAttempt = {
  readonly status: string | null;
  readonly password: (credentials: Credentials) => FlowResult;
  readonly create: (account: { readonly identifier: string }) => FlowResult;
  readonly mfa: {
    readonly sendEmailCode: () => FlowResult;
    readonly verifyEmailCode: (entry: CodeEntry) => FlowResult;
  };
  readonly resetPasswordEmailCode: {
    readonly sendCode: () => FlowResult;
    readonly verifyCode: (entry: CodeEntry) => FlowResult;
    readonly submitPassword: (choice: {
      readonly password: string;
      readonly signOutOfOtherSessions: boolean;
    }) => FlowResult;
  };
  readonly finalize: Finalize;
};

export type SignUpAttempt = {
  readonly status: string | null;
  readonly missingFields: readonly string[];
  readonly password: (credentials: Credentials) => FlowResult;
  readonly verifications: {
    readonly sendEmailCode: () => FlowResult;
    readonly verifyEmailCode: (entry: CodeEntry) => FlowResult;
  };
  readonly finalize: Finalize;
};

export type PasswordAttempts = {
  readonly signIn: SignInAttempt;
  readonly signUp: SignUpAttempt;
};

export type PasswordSignInDependencies = {
  readonly loadAttempts: () => Promise<PasswordAttempts>;
  readonly goHome: (decorateUrl: DecorateUrl) => void;
  readonly show: (view: SignInView) => void;
};

export const GENERIC_ERROR = "Something went wrong. Try again.";

export const MISSING_EMAIL_ERROR = "Enter your email first, then choose Forgot password.";

export const WRONG_PASSWORD_ERROR = "That password is incorrect. Try again, or reset it.";

export const CHALLENGED_SIGN_UP_ERROR =
  "We couldn't confirm this sign-up. Turn off any VPN or proxy and try again.";

export const MIN_PASSWORD_LENGTH = 15;

export const CODE_LENGTH = 6;

export const CODE_REASONS: Record<CodePurpose, string> = {
  "sign-up": "finish creating your account",
  "new-device": "confirm it's you on this device",
  reset: "reset your password",
  "set-password": "set a password for your account, which has none yet",
};

const UNKNOWN_EMAIL_CODE = "form_identifier_not_found";

const NO_PASSWORD_CODE = "strategy_for_user_invalid";

const PROTECT_CHECK_FIELD = "protect_check";

const INCOMPLETE: FlowError = { message: "incomplete" };

const CHALLENGED_SIGN_UP: FlowError = {
  message: CHALLENGED_SIGN_UP_ERROR,
  errors: [{ code: "sign_up_challenged", message: CHALLENGED_SIGN_UP_ERROR }],
};

const MESSAGES_BY_CODE = new Map([["form_password_incorrect", WRONG_PASSWORD_ERROR]]);

const FIELDS_BY_PARAMETER = new Map<string, SignInField>([
  ["identifier", "email"],
  ["email_address", "email"],
  ["password", "password"],
  ["code", "code"],
]);

const INITIAL_VIEW: SignInView = {
  step: "credentials",
  codePurpose: "sign-up",
  emailAddress: "",
  isBusy: false,
  wasCodeResent: false,
  errorMessage: null,
  errorField: null,
};

const NO_ERROR = { errorMessage: null, errorField: null } as const;

function describeError(error: FlowError): Pick<SignInView, "errorMessage" | "errorField"> {
  const [problem] = error.errors ?? [];

  if (problem === undefined) return { errorMessage: GENERIC_ERROR, errorField: null };

  return {
    errorMessage: MESSAGES_BY_CODE.get(problem.code) ?? problem.longMessage ?? problem.message,
    errorField: FIELDS_BY_PARAMETER.get(problem.meta?.paramName ?? "") ?? null,
  };
}

function codeOf(error: FlowError): string | undefined {
  return error.errors?.[0]?.code;
}

function sendCode(purpose: CodePurpose, { signIn, signUp }: PasswordAttempts): FlowResult {
  if (purpose === "sign-up") return signUp.verifications.sendEmailCode();

  if (purpose === "new-device") return signIn.mfa.sendEmailCode();

  return signIn.resetPasswordEmailCode.sendCode();
}

function verifyCode(
  purpose: CodePurpose,
  { signIn, signUp }: PasswordAttempts,
  entry: CodeEntry,
): FlowResult {
  if (purpose === "sign-up") return signUp.verifications.verifyEmailCode(entry);

  if (purpose === "new-device") return signIn.mfa.verifyEmailCode(entry);

  return signIn.resetPasswordEmailCode.verifyCode(entry);
}

export function createPasswordSignIn({ loadAttempts, goHome, show }: PasswordSignInDependencies) {
  let view = INITIAL_VIEW;
  let isLeaving = false;

  const update = (changes: Partial<SignInView>) => {
    view = { ...view, ...changes };
    show(view);
  };

  const navigate = ({ decorateUrl }: { readonly decorateUrl: DecorateUrl }) => {
    isLeaving = true;
    goHome(decorateUrl);
  };

  async function askForCode(purpose: CodePurpose, attempts: PasswordAttempts) {
    const sent = await sendCode(purpose, attempts);

    if (sent.error !== null) return sent.error;

    update({ step: "code", codePurpose: purpose });

    return null;
  }

  async function continueSignIn(attempts: PasswordAttempts): Promise<FlowError | null> {
    const { status } = attempts.signIn;

    if (status === "complete") return (await attempts.signIn.finalize({ navigate })).error;

    if (status === "needs_client_trust" || status === "needs_second_factor") {
      return askForCode("new-device", attempts);
    }

    if (status !== "needs_new_password") return INCOMPLETE;

    update({ step: "new-password" });

    return null;
  }

  async function finishSignUp({ signUp }: PasswordAttempts) {
    if (signUp.status !== "complete") return INCOMPLETE;

    return (await signUp.finalize({ navigate })).error;
  }

  async function signUpWithPassword(attempts: PasswordAttempts, credentials: Credentials) {
    const created = await attempts.signUp.password(credentials);

    if (created.error !== null) return created.error;

    if (attempts.signUp.missingFields.includes(PROTECT_CHECK_FIELD)) return CHALLENGED_SIGN_UP;

    return askForCode("sign-up", attempts);
  }

  async function startReset(
    attempts: PasswordAttempts,
    emailAddress: string,
    purpose: CodePurpose,
  ) {
    const created = await attempts.signIn.create({ identifier: emailAddress });

    return created.error ?? askForCode(purpose, attempts);
  }

  async function signInWithPassword(attempts: PasswordAttempts, credentials: Credentials) {
    const { error } = await attempts.signIn.password(credentials);

    if (error === null) return continueSignIn(attempts);

    if (codeOf(error) === UNKNOWN_EMAIL_CODE) return signUpWithPassword(attempts, credentials);

    if (codeOf(error) === NO_PASSWORD_CODE) {
      return startReset(attempts, credentials.emailAddress, "set-password");
    }

    return error;
  }

  async function submitCode(attempts: PasswordAttempts, code: string) {
    const purpose = view.codePurpose;
    const verified = await verifyCode(purpose, attempts, { code });

    if (verified.error !== null) return verified.error;

    return purpose === "sign-up" ? finishSignUp(attempts) : continueSignIn(attempts);
  }

  async function submitNewPassword(attempts: PasswordAttempts, password: string) {
    const saved = await attempts.signIn.resetPasswordEmailCode.submitPassword({
      password,
      signOutOfOtherSessions: true,
    });

    return saved.error ?? continueSignIn(attempts);
  }

  async function run(
    step: SignInStep,
    action: (attempts: PasswordAttempts) => Promise<FlowError | null>,
    changes: Partial<SignInView> = {},
  ) {
    if (view.isBusy || view.step !== step) return null;

    update({ ...changes, ...NO_ERROR, isBusy: true, wasCodeResent: false });

    const error = await loadAttempts()
      .then(action)
      .catch((): FlowError => ({ message: GENERIC_ERROR }));

    update({ isBusy: isLeaving, ...(error === null ? NO_ERROR : describeError(error)) });

    return error;
  }

  return {
    view: () => view,
    submitCredentials: async (emailAddress: string, password: string) => {
      await run(
        "credentials",
        (attempts) => signInWithPassword(attempts, { emailAddress, password }),
        { emailAddress },
      );
    },
    forgotPassword: async (emailAddress: string) => {
      if (emailAddress.trim() === "") {
        if (!view.isBusy) update({ errorMessage: MISSING_EMAIL_ERROR, errorField: "email" });

        return;
      }

      await run("credentials", (attempts) => startReset(attempts, emailAddress, "reset"), {
        emailAddress,
      });
    },
    submitCode: async (code: string) => {
      await run("code", (attempts) => submitCode(attempts, code));
    },
    resendCode: async () => {
      const error = await run("code", async (attempts) => {
        const sent = await sendCode(view.codePurpose, attempts);

        return sent.error;
      });

      if (error === null && view.step === "code") update({ wasCodeResent: true });
    },
    submitNewPassword: async (password: string) => {
      await run("new-password", (attempts) => submitNewPassword(attempts, password));
    },
    restart: () => {
      if (view.isBusy) return;

      update({ ...NO_ERROR, step: "credentials", wasCodeResent: false });
    },
  };
}
