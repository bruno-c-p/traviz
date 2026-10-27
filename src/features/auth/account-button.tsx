"use client";

import { UserRound } from "lucide-react";
import Link from "next/link";
import { accountPath } from "@/paths";
import { cn } from "@/shared/cn";
import { useAccountEmail } from "@/features/auth/use-account-email";

export function AccountButton({ className }: { className?: string }) {
  const initial = useAccountEmail()?.charAt(0).toUpperCase();

  return (
    <Link
      href={accountPath()}
      aria-label="Account"
      className={cn(
        "flex size-12 shrink-0 items-center justify-center rounded-full bg-ink-deep text-base font-semibold text-primary shadow-float pressable hover:bg-ink",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2",
        className,
      )}
    >
      {initial ?? <UserRound size={20} aria-hidden />}
    </Link>
  );
}
