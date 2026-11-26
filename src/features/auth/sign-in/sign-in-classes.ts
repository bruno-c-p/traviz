import type { SignInStep } from "@/features/auth/password-sign-in";

export const INPUT_CLASS =
  "h-12 w-full rounded-full border border-line bg-canvas px-5 text-base text-ink placeholder:text-mute focus:border-ink focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 aria-invalid:border-negative aria-invalid:focus:ring-negative";

export const PRIMARY_ACTION_CLASS =
  "mt-2 min-h-12 w-full rounded-full bg-primary px-5 text-[15px] font-semibold text-on-primary pressable hover:bg-primary-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:opacity-60";

export const TEXT_ACTION_CLASS =
  "min-h-11 rounded-full px-3 text-sm font-semibold text-ink underline decoration-line underline-offset-4 pressable hover:decoration-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink disabled:opacity-60";

export const LABEL_CLASS = "text-sm font-medium text-ink";

export const ERROR_CLASS = "px-1 text-sm text-negative-text";

export const HINT_CLASS = "px-1 text-xs leading-relaxed text-mute";

export const SUBMIT_LABELS: Record<SignInStep, string> = {
  credentials: "Continue",
  code: "Verify code",
  "new-password": "Save password and sign in",
};

export const BUSY_LABEL = "One moment…";
