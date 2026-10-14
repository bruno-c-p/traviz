"use client";

import { X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { homePath } from "@/paths";

const HINT_STORAGE_KEY = "traviz-first-run-hint-dismissed";

function readDismissed(): boolean {
  try {
    return globalThis.localStorage?.getItem(HINT_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function FirstRunHint() {
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(readDismissed);

  if (dismissed || pathname !== homePath()) return null;

  function dismiss() {
    try {
      globalThis.localStorage?.setItem(HINT_STORAGE_KEY, "1");
    } catch {
      /* localStorage unavailable: hint just reappears next visit */
    }
    setDismissed(true);
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-20 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-canvas/95 py-1.5 pl-5 pr-1.5 text-sm font-medium text-ink shadow-float backdrop-blur-md">
        <span>Tap any country to mark it</span>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss hint"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-canvas-soft text-body transition-colors hover:bg-land hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
