"use client";

import { UserRound } from "lucide-react";
import { lazy, Suspense, useId, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { cn } from "@/shared/cn";
import { useAccountEmail } from "@/features/auth/use-account-email";

function loadAccountMenu() {
  return import("@/features/auth/account-menu");
}

const AccountMenu = lazy(async () => ({ default: (await loadAccountMenu()).AccountMenu }));

export function AccountButton({ className }: { className?: string }) {
  const initial = useAccountEmail()?.charAt(0).toUpperCase();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const [isOpen, setIsOpen] = useState(false);

  function handleOpen() {
    setIsOpen(true);
    dialogRef.current?.showModal();
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) event.currentTarget.close();
  }

  return (
    <>
      <button
        type="button"
        aria-label="Account and theme"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={handleOpen}
        onPointerEnter={() => void loadAccountMenu()}
        onFocus={() => void loadAccountMenu()}
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-full bg-ink-deep text-base font-semibold text-primary shadow-float pressable hover:bg-ink-deep-soft",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2",
          className,
        )}
      >
        {initial ?? <UserRound size={20} aria-hidden />}
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={headingId}
        onClose={() => setIsOpen(false)}
        onClick={handleBackdropClick}
        className="fixed inset-x-0 top-auto bottom-0 m-0 max-h-[calc(100dvh-3rem)] w-full max-w-none overflow-y-auto rounded-t-[28px] border-0 bg-canvas p-0 text-ink shadow-card transition-[opacity,translate] duration-200 ease-out backdrop:bg-black/40 starting:opacity-0 motion-safe:starting:translate-y-3 md:inset-x-auto md:top-[76px] md:right-6 md:bottom-auto md:max-h-[calc(100dvh-100px)] md:w-[380px] md:rounded-3xl md:motion-safe:starting:-translate-y-2"
      >
        {isOpen && (
          <Suspense fallback={null}>
            <AccountMenu headingId={headingId} onClose={() => dialogRef.current?.close()} />
          </Suspense>
        )}
      </dialog>
    </>
  );
}
