import { Mail } from "lucide-react";

type EmailLinkSentProps = {
  emailAddress: string;
  onUseDifferentEmail: () => void;
};

export function EmailLinkSent({ emailAddress, onUseDifferentEmail }: EmailLinkSentProps) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3 rounded-2xl bg-primary-pale p-4">
        <Mail aria-hidden className="mt-0.5 size-5 shrink-0 text-ink-deep" />
        <p className="min-w-0 text-[15px] leading-relaxed text-ink-deep">
          We sent a sign-in link to{" "}
          <span className="font-semibold wrap-anywhere">{emailAddress}</span>. Open it on any device
          and this page will continue on its own.
        </p>
      </div>
      <button
        type="button"
        onClick={onUseDifferentEmail}
        className="min-h-12 w-full rounded-full border border-line bg-canvas px-5 text-[15px] font-semibold text-ink pressable hover:bg-canvas-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
      >
        Use a different email
      </button>
    </div>
  );
}
