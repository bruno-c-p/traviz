"use client";

import { AccountButton } from "@/features/auth";
import { MarksBoundary } from "@/features/marks";
import { StatsSummary } from "@/features/stats/stats-summary";

export function StatsPanel() {
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 pt-6 md:px-6 md:pt-2">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-ink md:text-4xl">Your travels</h1>
        <AccountButton className="md:hidden" />
      </div>

      <MarksBoundary>
        <StatsSummary />
      </MarksBoundary>
    </div>
  );
}
