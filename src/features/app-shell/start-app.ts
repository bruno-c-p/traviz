import { reloadWhenStale } from "@/features/app-shell/resume-reload";
import { startViewRouter } from "@/features/app-shell/view-router";
import { mountListView } from "@/features/country-list";
import { mountGlobeView } from "@/features/globe";
import {
  MARKS_SNAPSHOT_ID,
  marksStore,
  replayEarlyTaps,
  startMarksSession,
  takeEarlyTaps,
} from "@/features/marks";
import { mountStatsView } from "@/features/stats";

const INSTALLED_QUERY = "(display-mode: standalone)";

function reloadInstalledAppWhenStale() {
  if (!window.matchMedia(INSTALLED_QUERY).matches) return;

  reloadWhenStale({
    now: () => Date.now(),
    isVisible: () => document.visibilityState === "visible",
    isOnline: () => navigator.onLine,
    onVisibilityChange: (listener) => {
      document.addEventListener("visibilitychange", listener);

      return () => document.removeEventListener("visibilitychange", listener);
    },
    reload: () => window.location.reload(),
  });
}

export function startApp() {
  startMarksSession(marksStore, document.getElementById(MARKS_SNAPSHOT_ID)?.textContent);
  replayEarlyTaps(marksStore.getState(), takeEarlyTaps(window));

  startViewRouter({
    globe: (host) => mountGlobeView(host),
    list: (host) => mountListView(host, marksStore),
    stats: (host) => mountStatsView(host, marksStore),
  });

  reloadInstalledAppWhenStale();
}
