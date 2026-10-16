"use client";

import { useId } from "react";
import { ClearMarkButton, MarkChoices } from "@/features/marks";
import { CountryHeading } from "@/features/countries";
import type { Country } from "@/features/countries";
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
