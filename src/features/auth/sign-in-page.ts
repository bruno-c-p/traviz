import { clerkSession } from "@/features/auth/clerk-session";
import { createEmailLinkSignIn } from "@/features/auth/email-link-sign-in";
import type { EmailLinkAttempts, EmailLinkView } from "@/features/auth/email-link-sign-in";
import { hasActiveClient } from "@/features/auth/session-cookies";
import {
  SENDING_LABEL,
  SUBMIT_LABEL,
  emailInputClass,
} from "@/features/auth/sign-in/sign-in-classes";
import { homePath, signInVerifyPath } from "@/paths";

async function loadAttempts(): Promise<EmailLinkAttempts> {
  await clerkSession.ready();

  const client = window.Clerk?.client;

  if (client === undefined) throw new Error("Clerk loaded without a client.");

  return { signIn: client.signIn.__internal_future, signUp: client.signUp.__internal_future };
}

function goHomeWhenSignedInElsewhere() {
  const check = () => {
    if (document.visibilityState === "visible" && hasActiveClient(document.cookie)) {
      window.location.replace(homePath());
    }
  };

  document.addEventListener("visibilitychange", check);
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) check();
  });
}

export function startSignInPage() {
  const form = document.querySelector<HTMLFormElement>("[data-email-link-form]");
  const sent = document.querySelector<HTMLElement>("[data-email-link-sent]");
  const input = form?.querySelector<HTMLInputElement>("input[type=email]");
  const submitButton = form?.querySelector<HTMLButtonElement>("button[type=submit]");
  const errorText = form?.querySelector<HTMLElement>("[data-email-link-error]");
  const sentEmail = sent?.querySelector<HTMLElement>("[data-sent-email]");

  if (!form || !sent || !input || !submitButton || !errorText || !sentEmail) return;

  const show = ({ step, emailAddress, errorMessage }: EmailLinkView) => {
    const isSending = step === "sending";
    const hasError = errorMessage !== null;

    form.hidden = step === "sent";
    sent.hidden = step !== "sent";
    sentEmail.textContent = emailAddress;
    input.disabled = isSending;
    input.className = emailInputClass(hasError);
    submitButton.disabled = isSending;
    submitButton.textContent = isSending ? SENDING_LABEL : SUBMIT_LABEL;
    errorText.hidden = !hasError;
    errorText.textContent = errorMessage ?? "";

    if (hasError) {
      input.setAttribute("aria-invalid", "true");
      input.setAttribute("aria-describedby", errorText.id);
    } else {
      input.removeAttribute("aria-invalid");
      input.removeAttribute("aria-describedby");
    }
  };

  const signIn = createEmailLinkSignIn({
    loadAttempts,
    verificationUrl: new URL(signInVerifyPath(), window.location.origin).href,
    goHome: (decorateUrl) => {
      window.location.assign(decorateUrl(homePath()));
    },
    show,
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void signIn.submit(input.value);
  });

  sent.querySelector("[data-use-different-email]")?.addEventListener("click", signIn.restart);

  goHomeWhenSignedInElsewhere();
  clerkSession.loadNow();
}
