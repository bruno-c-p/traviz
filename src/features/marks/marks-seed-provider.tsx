"use client";

import { MarksSeedContext, type MarksSeed } from "@/features/marks/marks-seed";

export function MarksSeedProvider({
  seed,
  children,
}: {
  seed: MarksSeed;
  children: React.ReactNode;
}) {
  return <MarksSeedContext value={seed}>{children}</MarksSeedContext>;
}
