"use client";

import { useId } from "react";
import { createPortal } from "react-dom";
import { ClearMarkButton } from "@/components/clear-mark-button";
import { CountryHeading } from "@/components/country-heading";
import { MarkChoices } from "@/components/mark-choices";
import type { Country } from "@/lib/stats";
import { useSelectedCountryStore } from "@/store/selected-country";

export function CountrySheet({ country }: { country: Country }) {
  const headingId = useId();
  const clearSelection = useSelectedCountryStore((state) => state.clearSelection);

  return createPortal(
    <div className="md:hidden">
      <div aria-hidden className="fixed inset-0 z-[55] bg-ink/30" onClick={clearSelection} />
      <section
        role="dialog"
        aria-labelledby={headingId}
        className="fixed inset-x-0 bottom-0 z-[60] flex flex-col gap-4 rounded-t-[28px] bg-canvas px-5 pt-3 shadow-card"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        <div aria-hidden className="mx-auto h-1 w-10 rounded-full bg-line" />
        <CountryHeading country={country} headingId={headingId} onClose={clearSelection} />
        <MarkChoices code={country.code} countryName={country.name} layout="rows" />
        <ClearMarkButton code={country.code} className="self-center" />
      </section>
    </div>,
    document.body,
  );
}
