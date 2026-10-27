"use client";

import { useId } from "react";
import { EmailLinkSent } from "@/features/auth/email-link-sent";
import { useEmailLinkSignIn } from "@/features/auth/use-email-link-sign-in";
import { cn } from "@/shared/cn";

export function EmailLinkForm() {
  const errorId = useId();

  const { emailAddress, setEmailAddress, step, errorMessage, handleSubmit, restart } =
    useEmailLinkSignIn();

  if (step === "sent") {
    return <EmailLinkSent emailAddress={emailAddress} onUseDifferentEmail={restart} />;
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
          "h-12 w-full rounded-full border bg-canvas px-5 text-base text-ink placeholder:text-mute focus:border-ink focus:outline-none focus:ring-2 disabled:opacity-60",
          errorMessage ? "border-negative focus:ring-negative" : "border-line focus:ring-primary",
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
