"use client";

import { useId } from "react";
import { ClearMarkButton } from "@/components/clear-mark-button";
import { CountryHeading } from "@/components/country-heading";
import { MarkChoices } from "@/components/mark-choices";
import type { Country } from "@/lib/stats";
import { useSelectedCountryStore } from "@/store/selected-country";

export function CountryCard({ country }: { country: Country }) {
  const headingId = useId();
  const clearSelection = useSelectedCountryStore((state) => state.clearSelection);

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-5 rounded-3xl bg-canvas p-5 shadow-card transition-[translate,opacity] duration-200 ease-out starting:opacity-0 motion-safe:starting:translate-y-1"
    >
      <CountryHeading country={country} headingId={headingId} onClose={clearSelection} />
      <MarkChoices code={country.code} countryName={country.name} layout="tiles" />
      <ClearMarkButton code={country.code} className="-my-2 self-start px-1" />
    </section>
  );
}
