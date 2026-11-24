"use client";

import { useEffect } from "react";
import { AccountButton } from "@/features/auth";
import { CountryCard } from "@/features/globe/country-card";
import { CountrySearch } from "@/features/globe/country-search";
import { CountrySheet } from "@/features/globe/country-sheet";
import { GlobeHint } from "@/features/globe/globe-hint";
import { MapLegend } from "@/features/globe/map-legend";
import { MarksBoundary } from "@/features/marks";
import { ProgressCard } from "@/features/stats";
import { COUNTRIES_BY_CODE } from "@/features/countries";
import { useSelectedCountryStore } from "@/features/globe/selected-country";

export function GlobeOverlay() {
  const selectedCode = useSelectedCountryStore((state) => state.selectedCode);
  const clearSelection = useSelectedCountryStore((state) => state.clearSelection);
  const country = selectedCode ? COUNTRIES_BY_CODE.get(selectedCode) : undefined;

  useEffect(() => {
    if (!selectedCode) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") clearSelection();
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedCode, clearSelection]);

  return (
    <>
      <div className="pointer-events-auto fixed inset-x-4 top-4 z-40 flex items-center gap-2.5 md:hidden">
        <CountrySearch className="min-w-0 flex-1" />
        <AccountButton />
      </div>

      <aside
        aria-label="Globe details"
        className="pointer-events-auto fixed right-6 top-[88px] z-30 hidden max-h-[calc(100dvh-112px)] w-[340px] flex-col gap-4 overflow-y-auto md:flex lg:w-[380px]"
      >
        {country ? (
          <MarksBoundary>
            <CountryCard country={country} />
          </MarksBoundary>
        ) : (
          <GlobeHint />
        )}
        <MarksBoundary>
          <ProgressCard variant="panel" />
        </MarksBoundary>
      </aside>

      <MapLegend className="pointer-events-auto fixed bottom-10 left-6 z-30 hidden md:flex" />

      <div
        className="pointer-events-auto fixed inset-x-4 z-30 md:hidden"
        style={{ bottom: "calc(max(1rem, env(safe-area-inset-bottom)) + 84px)" }}
      >
        <MarksBoundary>
          <ProgressCard variant="peek" />
        </MarksBoundary>
      </div>

      {country && (
        <MarksBoundary>
          <CountrySheet country={country} />
        </MarksBoundary>
      )}
    </>
  );
}
