import { useSignIn, useSignUp } from "@clerk/nextjs";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { decoratedPath, homePath, signInVerifyPath } from "@/paths";

type EmailLinkStep = "email" | "sending" | "sent";

const GENERIC_ERROR = "Something went wrong. Try again.";

function toErrorMessage(error: Error) {
  if (isClerkAPIResponseError(error)) {
    return error.errors[0]?.longMessage ?? error.errors[0]?.message ?? GENERIC_ERROR;
  }

  return GENERIC_ERROR;
}

function isUnknownEmail(error: Error | null) {
  return isClerkAPIResponseError(error) && error.errors[0]?.code === "form_identifier_not_found";
}

export function useEmailLinkSignIn() {
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const router = useRouter();
  const [emailAddress, setEmailAddress] = useState("");
  const [step, setStep] = useState<EmailLinkStep>("email");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function fail(message: string) {
    setErrorMessage(message);
    setStep("email");
  }

  function navigateHome({ decorateUrl }: { decorateUrl: (url: string) => string }) {
    const url = decoratedPath(decorateUrl, homePath());

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

  return {
    emailAddress,
    setEmailAddress,
    step,
    errorMessage,
    handleSubmit,
    restart: () => setStep("email"),
  };
}
