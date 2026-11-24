import { isEmailLinkError } from "@clerk/shared/error";
import { clerkSession } from "@/features/auth/clerk-session";
import {
  VERIFICATION_MESSAGES,
  canRetry,
  verifyEmailLink,
} from "@/features/auth/email-link-verification";
import type { VerificationStatus } from "@/features/auth/email-link-verification";
import { homePath } from "@/paths";

async function verify(onVerifiedOnOtherDevice: () => void) {
  await clerkSession.ready();

  const clerk = window.Clerk;

  if (clerk === undefined) throw new Error("Clerk loaded without defining window.Clerk.");

  await clerk.handleEmailLinkVerification({
    redirectUrlComplete: homePath(),
    onVerifiedOnOtherDevice,
  });
}

export function startVerifyPage() {
  const title = document.querySelector<HTMLElement>("[data-verification-title]");
  const body = document.querySelector<HTMLElement>("[data-verification-body]");
  const retry = document.querySelector<HTMLElement>("[data-verification-retry]");

  if (!title || !body || !retry) return;

  const show = (status: VerificationStatus) => {
    title.textContent = VERIFICATION_MESSAGES[status].title;
    body.textContent = VERIFICATION_MESSAGES[status].body;
    retry.hidden = !canRetry(status);
    document.documentElement.dataset.verification = status;
  };

  clerkSession.loadNow();

  void verifyEmailLink({
    verify,
    failureOf: (cause: unknown) => ({
      code: cause instanceof Error && isEmailLinkError(cause) ? cause.code : null,
    }),
    show,
  });
}
