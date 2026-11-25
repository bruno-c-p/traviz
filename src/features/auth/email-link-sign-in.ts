export type EmailLinkStep = "email" | "sending" | "sent";

export type EmailLinkView = {
  readonly step: EmailLinkStep;
  readonly emailAddress: string;
  readonly errorMessage: string | null;
};

type ApiProblem = {
  readonly code: string;
  readonly message: string;
  readonly longMessage?: string;
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

export type SignInAttempt = {
  readonly status: string | null;
  readonly emailLink: {
    readonly sendLink: (link: {
      readonly emailAddress: string;
      readonly verificationUrl: string;
    }) => FlowResult;
    readonly waitForVerification: () => FlowResult;
  };
  readonly finalize: Finalize;
};

export type SignUpAttempt = {
  readonly status: string | null;
  readonly create: (account: { readonly emailAddress: string }) => FlowResult;
  readonly verifications: {
    readonly sendEmailLink: (link: { readonly verificationUrl: string }) => FlowResult;
    readonly waitForEmailLinkVerification: () => FlowResult;
  };
  readonly finalize: Finalize;
};

export type EmailLinkAttempts = {
  readonly signIn: SignInAttempt;
  readonly signUp: SignUpAttempt;
};

export type EmailLinkDependencies = {
  readonly loadAttempts: () => Promise<EmailLinkAttempts>;
  readonly verificationUrl: string;
  readonly goHome: (decorateUrl: DecorateUrl) => void;
  readonly show: (view: EmailLinkView) => void;
};

export const GENERIC_ERROR = "Something went wrong. Try again.";

const UNKNOWN_EMAIL_CODE = "form_identifier_not_found";

const INCOMPLETE: FlowError = { message: "incomplete" };

function toErrorMessage(error: FlowError): string {
  const [problem] = error.errors ?? [];

  return problem?.longMessage ?? problem?.message ?? GENERIC_ERROR;
}

function isUnknownEmail(error: FlowError | null): boolean {
  return error?.errors?.[0]?.code === UNKNOWN_EMAIL_CODE;
}

export function createEmailLinkSignIn({
  loadAttempts,
  verificationUrl,
  goHome,
  show,
}: EmailLinkDependencies) {
  let view: EmailLinkView = { step: "email", emailAddress: "", errorMessage: null };
  let latestFlow = 0;

  const update = (changes: Partial<EmailLinkView>) => {
    view = { ...view, ...changes };
    show(view);
  };

  const navigate = ({ decorateUrl }: { readonly decorateUrl: DecorateUrl }) => {
    goHome(decorateUrl);
  };

  async function signInWithLink(signIn: SignInAttempt, emailAddress: string, onSent: () => void) {
    const sent = await signIn.emailLink.sendLink({ emailAddress, verificationUrl });

    if (sent.error !== null) return sent.error;

    onSent();

    const waited = await signIn.emailLink.waitForVerification();

    if (waited.error !== null) return waited.error;

    if (signIn.status !== "complete") return INCOMPLETE;

    return (await signIn.finalize({ navigate })).error;
  }

  async function signUpWithLink(signUp: SignUpAttempt, emailAddress: string, onSent: () => void) {
    const created = await signUp.create({ emailAddress });

    if (created.error !== null) return created.error;

    const sent = await signUp.verifications.sendEmailLink({ verificationUrl });

    if (sent.error !== null) return sent.error;

    onSent();

    const waited = await signUp.verifications.waitForEmailLinkVerification();

    if (waited.error !== null) return waited.error;

    if (signUp.status !== "complete") return INCOMPLETE;

    return (await signUp.finalize({ navigate })).error;
  }

  async function run(emailAddress: string, onSent: () => void): Promise<FlowError | null> {
    const { signIn, signUp } = await loadAttempts();
    const signInError = await signInWithLink(signIn, emailAddress, onSent);

    return isUnknownEmail(signInError) ? signUpWithLink(signUp, emailAddress, onSent) : signInError;
  }

  return {
    view: () => view,
    submit: async (emailAddress: string) => {
      if (view.step !== "email") return;

      latestFlow += 1;

      const flow = latestFlow;
      const isLatest = () => flow === latestFlow;

      update({ step: "sending", emailAddress, errorMessage: null });

      const error = await run(emailAddress, () => {
        if (isLatest()) update({ step: "sent" });
      }).catch((): FlowError => ({ message: GENERIC_ERROR }));

      if (error !== null && isLatest()) {
        update({ step: "email", errorMessage: toErrorMessage(error) });
      }
    },
    restart: () => {
      latestFlow += 1;
      update({ step: "email", errorMessage: null });
    },
  };
}
