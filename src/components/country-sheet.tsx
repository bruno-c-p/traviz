"use client";

import { useId } from "react";
import { createPortal } from "react-dom";
import { ClearMarkButton } from "@/components/clear-mark-button";
import { CountryHeading } from "@/components/country-heading";
import { MarkChoices } from "@/components/mark-choices";
import { useDraggableSheet } from "@/hooks/use-draggable-sheet";
import { useIsClient } from "@/hooks/use-is-client";
import type { Country } from "@/lib/stats";

export function CountrySheet({ country }: { country: Country }) {
  const headingId = useId();
  const isClient = useIsClient();
  const { sheetRef, backdropRef, close, sheetHandlers } = useDraggableSheet();

  if (!isClient) return null;

  return createPortal(
    <div className="md:hidden">
      <div
        ref={backdropRef}
        aria-hidden
        className="fixed inset-0 z-[55] bg-ink/30 transition-opacity duration-300 ease-out starting:opacity-0"
        onClick={close}
      />
      <dialog
        open
        ref={sheetRef}
        aria-labelledby={headingId}
        {...sheetHandlers}
        className="fixed inset-x-0 bottom-0 z-[60] m-0 flex h-auto max-h-none w-full max-w-none touch-none flex-col gap-4 rounded-t-[28px] border-0 bg-canvas px-5 pt-3 text-inherit shadow-card transition-[translate,opacity] duration-[400ms] ease-drawer after:absolute after:inset-x-0 after:top-[calc(100%-1px)] after:h-screen after:bg-canvas motion-safe:starting:translate-y-full motion-reduce:starting:opacity-0"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        <div aria-hidden className="mx-auto h-1 w-10 rounded-full bg-line" />
        <CountryHeading country={country} headingId={headingId} onClose={close} />
        <MarkChoices code={country.code} countryName={country.name} layout="rows" />
        <ClearMarkButton code={country.code} className="self-center" />
      </dialog>
    </div>,
    document.body,
  );
}
