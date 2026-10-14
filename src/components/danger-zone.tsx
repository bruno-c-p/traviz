"use client";

import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useCountriesStore } from "@/store/countries";

const DANGER_BUTTON_CLASS =
  "min-h-11 rounded-full bg-negative px-5 text-sm font-semibold text-canvas hover:bg-negative-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2";

export function DangerZone({ className }: { className?: string }) {
  const resetAll = useCountriesStore((state) => state.resetAll);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isResetDone, setIsResetDone] = useState(false);

  function handleResetConfirmed() {
    resetAll();
    setIsConfirming(false);
    setIsResetDone(true);
  }

  return (
    <section
      aria-labelledby="danger-zone-heading"
      className={cn(
        "flex flex-col gap-4 rounded-3xl bg-canvas p-5 shadow-card ring-1 ring-negative/20",
        className,
      )}
    >
      <h2
        id="danger-zone-heading"
        className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-negative-deep"
      >
        <AlertTriangle size={14} aria-hidden />
        Danger zone
      </h2>
      <p className="text-[15px] leading-relaxed text-body">
        Permanently erase every mark. This cannot be undone.
      </p>
      {isConfirming ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-negative-pale p-4">
          <p className="text-sm font-medium text-negative-darkest">
            Are you sure? All marks will be permanently deleted.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleResetConfirmed} className={DANGER_BUTTON_CLASS}>
              Yes, erase everything
            </button>
            <button
              type="button"
              onClick={() => setIsConfirming(false)}
              className="min-h-11 rounded-full bg-canvas px-5 text-sm font-semibold text-ink hover:bg-land focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setIsResetDone(false);
            setIsConfirming(true);
          }}
          className={cn(DANGER_BUTTON_CLASS, "self-start")}
        >
          Reset all data
        </button>
      )}
      {isResetDone && (
        <p role="status" className="text-sm text-body">
          All data has been reset.
        </p>
      )}
    </section>
  );
}
