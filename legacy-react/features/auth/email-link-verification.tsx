"use client";

import { useClerk } from "@clerk/nextjs";
import { EmailLinkErrorCodeStatus, isEmailLinkError } from "@clerk/nextjs/errors";
import Link from "next/link";
import { useEffect, useState } from "react";
import { homePath, signInPath } from "@/paths";

const MESSAGES = {
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
};

type Status = keyof typeof MESSAGES;

function toFailureStatus(cause: unknown): Status {
  if (!(cause instanceof Error) || !isEmailLinkError(cause)) return "failed";

  if (cause.code === EmailLinkErrorCodeStatus.Expired) return "expired";

  if (cause.code === EmailLinkErrorCodeStatus.ClientMismatch) return "client_mismatch";

  return "failed";
}

export function EmailLinkVerification() {
  const { handleEmailLinkVerification, loaded } = useClerk();
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    if (!loaded) return;
    handleEmailLinkVerification({
      redirectUrlComplete: homePath(),
      onVerifiedOnOtherDevice: () => setStatus("verified"),
    })
      .then(() => setStatus("verified"))
      .catch((error: unknown) => setStatus(toFailureStatus(error)));
  }, [loaded, handleEmailLinkVerification]);

  const message = MESSAGES[status];
  const canRetry = status !== "checking" && status !== "verified";

  return (
    <div className="flex flex-col items-start gap-3">
      <h1 className="text-2xl font-bold tracking-tight text-ink">{message.title}</h1>
      <p className="text-[15px] leading-relaxed text-body">{message.body}</p>
      {canRetry && (
        <Link
          href={signInPath()}
          className="mt-4 flex min-h-12 w-full items-center justify-center rounded-full bg-primary px-5 text-[15px] font-semibold text-on-primary pressable hover:bg-primary-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
        >
          Get a new link
        </Link>
      )}
    </div>
  );
}
