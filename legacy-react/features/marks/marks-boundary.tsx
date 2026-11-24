"use client";

import { Suspense } from "react";
import { MarksSeedContext } from "@/features/marks/marks-seed";

export function MarksBoundary({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <MarksSeedContext value={null}>
          <div data-marks-pending className="contents">
            {children}
          </div>
        </MarksSeedContext>
      }
    >
      {children}
    </Suspense>
  );
}
