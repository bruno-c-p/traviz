"use client";

import { useEffect } from "react";
import { reloadWhenStale } from "@/features/app-shell/resume-reload";

const INSTALLED_QUERY = "(display-mode: standalone)";

export function ReloadStaleApp() {
  useEffect(() => {
    if (!window.matchMedia(INSTALLED_QUERY).matches) return;

    return reloadWhenStale({
      now: () => Date.now(),
      isVisible: () => document.visibilityState === "visible",
      isOnline: () => navigator.onLine,
      onVisibilityChange: (listener) => {
        document.addEventListener("visibilitychange", listener);

        return () => document.removeEventListener("visibilitychange", listener);
      },
      reload: () => window.location.reload(),
    });
  }, []);

  return null;
}
