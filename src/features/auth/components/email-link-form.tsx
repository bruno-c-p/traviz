"use client";

import { useSignIn, useSignUp } from "@clerk/nextjs";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import type { FormEvent } from "react";
import { cn } from "@/lib/utils";
import { homePath, signInVerifyPath } from "@/paths";

type Step = "email" | "sending" | "sent";

const GENERIC_ERROR = "Something went wrong. Try again.";

function toErrorMessage(error: unknown) {
  if (isClerkAPIResponseError(error)) {
    return error.errors[0]?.longMessage ?? error.errors[0]?.message ?? GENERIC_ERROR;
  }
  return GENERIC_ERROR;
}

function isUnknownEmail(error: unknown) {
  return isClerkAPIResponseError(error) && error.errors[0]?.code === "form_identifier_not_found";
}

export function EmailLinkForm() {
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const router = useRouter();
  const errorId = useId();
  const [emailAddress, setEmailAddress] = useState("");
  const [step, setStep] = useState<Step>("email");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function fail(message: string) {
    setErrorMessage(message);
    setStep("email");
  }

  function navigateHome({ decorateUrl }: { decorateUrl: (url: string) => string }) {
    const url = decorateUrl(homePath());
    if (url.startsWith("http")) {
      window.location.href = url;
    } else {
      router.push(url);
    }
  }

  async function signInWithLink(verificationUrl: string) {
    const sendResult = await signIn.emailLink.sendLink({ emailAddress, verificationUrl });
    if (sendResult.error) return sendResult.error;

    setStep("sent");
    const waitResult = await signIn.emailLink.waitForVerification();
    if (waitResult.error) return waitResult.error;
    if (signIn.status !== "complete") return new Error(signIn.status ?? "incomplete");

    const finalizeResult = await signIn.finalize({ navigate: navigateHome });
    return finalizeResult.error;
  }

  async function signUpWithLink(verificationUrl: string) {
    const createResult = await signUp.create({ emailAddress });
    if (createResult.error) return createResult.error;

    const sendResult = await signUp.verifications.sendEmailLink({ verificationUrl });
    if (sendResult.error) return sendResult.error;

    setStep("sent");
    const waitResult = await signUp.verifications.waitForEmailLinkVerification();
    if (waitResult.error) return waitResult.error;
    if (signUp.status !== "complete") return new Error(signUp.status ?? "incomplete");

    const finalizeResult = await signUp.finalize({ navigate: navigateHome });
    return finalizeResult.error;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setStep("sending");

    const verificationUrl = new URL(signInVerifyPath(), window.location.origin).href;
    const signInError = await signInWithLink(verificationUrl);
    const error = isUnknownEmail(signInError) ? await signUpWithLink(verificationUrl) : signInError;

    if (error) fail(toErrorMessage(error));
  }

  if (step === "sent") {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-3 rounded-2xl bg-primary-pale p-4">
          <Mail aria-hidden className="mt-0.5 size-5 shrink-0 text-ink-deep" />
          <p className="min-w-0 text-[15px] leading-relaxed text-ink-deep">
            We sent a sign-in link to{" "}
            <span className="font-semibold wrap-anywhere">{emailAddress}</span>. Open it on any
            device and this page will continue on its own.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setStep("email")}
          className="min-h-12 w-full rounded-full border border-line bg-canvas px-5 text-[15px] font-semibold text-ink pressable hover:bg-canvas-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
        >
          Use a different email
        </button>
      </div>
    );
  }

  const isSending = step === "sending";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label htmlFor="email" className="text-sm font-medium text-ink">
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        value={emailAddress}
        placeholder="you@example.com"
        disabled={isSending}
        aria-invalid={errorMessage ? true : undefined}
        aria-describedby={errorMessage ? errorId : undefined}
        onChange={(event) => setEmailAddress(event.target.value)}
        className={cn(
          "h-12 w-full rounded-full border border-line bg-canvas px-5 text-base text-ink placeholder:text-mute focus:border-ink focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60",
          errorMessage && "border-negative focus:ring-negative",
        )}
      />
      {errorMessage && (
        <p id={errorId} role="alert" className="px-1 text-sm text-negative-deep">
          {errorMessage}
        </p>
      )}
      <button
        type="submit"
        disabled={isSending}
        className="mt-2 min-h-12 w-full rounded-full bg-primary px-5 text-[15px] font-semibold text-on-primary pressable hover:bg-primary-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:opacity-60"
      >
        {isSending ? "Sending link…" : "Continue with email"}
      </button>
      <p className="px-1 text-center text-xs leading-relaxed text-mute">
        New here? The same link creates your account.
      </p>
    </form>
  );
}
