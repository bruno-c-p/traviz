const EMAIL_INPUT_CLASS =
  "h-12 w-full rounded-full border bg-canvas px-5 text-base text-ink placeholder:text-mute focus:border-ink focus:outline-none focus:ring-2 disabled:opacity-60";

export function emailInputClass(hasError: boolean): string {
  return `${EMAIL_INPUT_CLASS} ${hasError ? "border-negative focus:ring-negative" : "border-line focus:ring-primary"}`;
}

export const PRIMARY_ACTION_CLASS =
  "min-h-12 w-full rounded-full bg-primary px-5 text-[15px] font-semibold text-on-primary pressable hover:bg-primary-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2";

export const SUBMIT_LABEL = "Continue with email";

export const SENDING_LABEL = "Sending link…";
