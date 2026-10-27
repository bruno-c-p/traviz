"use client";

import { AccountSection } from "@/features/auth";
import { DangerZone, MarksBoundary } from "@/features/marks";
import { StatsSummary } from "@/features/stats/stats-summary";

export function StatsPanel() {
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 pt-6 md:px-6 md:pt-2">
      <h1 className="text-3xl font-bold tracking-tight text-ink md:text-4xl">Your travels</h1>

      <MarksBoundary>
        <StatsSummary />
      </MarksBoundary>

      <div className="flex flex-wrap gap-4">
        <AccountSection className="min-w-0 flex-[1_1_360px]" />
        <DangerZone className="min-w-0 flex-[1_1_360px]" />
      </div>
    </div>
  );
}
