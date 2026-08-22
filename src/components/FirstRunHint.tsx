import { X } from "lucide-react";
import { useState } from "react";

const HINT_STORAGE_KEY = "traviz-first-run-hint-dismissed";

function readDismissed(): boolean {
  try {
    return globalThis.localStorage?.getItem(HINT_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function FirstRunHint() {
  const [dismissed, setDismissed] = useState(readDismissed);

  if (dismissed) return null;

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
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 py-2 pl-4 pr-2 text-sm text-slate-700 shadow-lg backdrop-blur-md">
        <span>Tap any country to mark it</span>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss hint"
          className="rounded-full p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
