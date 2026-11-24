export const VERIFICATION_MESSAGES = {
  checking: {
    title: "Checking your link…",
    body: "Hold on a moment.",
  },
  verified: {
    title: "You're signed in",
    body: "Head back to the tab where you started. You can close this one.",
  },
  expired: {
    title: "This link has expired",
    body: "Links only work for a short time. Request a new one to continue.",
  },
  failed: {
    title: "We couldn't verify this link",
    body: "Request a new link and try again.",
  },
  client_mismatch: {
    title: "Open the link on the same device",
    body: "Request a new link from the browser you want to sign in on.",
  },
} as const;

export type VerificationStatus = keyof typeof VERIFICATION_MESSAGES;

export type VerificationFailure = { readonly code: string | null };

export type VerificationDependencies = {
  readonly verify: (onVerifiedOnOtherDevice: () => void) => Promise<void>;
  readonly failureOf: (cause: unknown) => VerificationFailure;
  readonly show: (status: VerificationStatus) => void;
};

export function canRetry(status: VerificationStatus): boolean {
  return status !== "checking" && status !== "verified";
}

export function failureStatus({ code }: VerificationFailure): VerificationStatus {
  if (code === "expired") return "expired";

  if (code === "client_mismatch") return "client_mismatch";

  return "failed";
}

export async function verifyEmailLink({ verify, failureOf, show }: VerificationDependencies) {
  show("checking");

  try {
    await verify(() => show("verified"));
    show("verified");
  } catch (cause: unknown) {
    show(failureStatus(failureOf(cause)));
  }
}
