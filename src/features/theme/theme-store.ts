import { parseThemeChoice, resolveTheme, THEME_STORAGE_KEY } from "@/features/theme/theme";
import type { Theme, ThemeChoice } from "@/features/theme/theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

const listeners = new Set<() => void>();

let isWatching = false;

function notify() {
  for (const listener of listeners) listener();
}

function watch() {
  if (isWatching) return;

  isWatching = true;
  window.matchMedia(DARK_QUERY).addEventListener("change", notify);
  new MutationObserver(notify).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
}

export function subscribeTheme(listener: () => void): () => void {
  watch();
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function themeChoice(): ThemeChoice {
  return parseThemeChoice(document.documentElement.dataset.theme);
}

export function shownTheme(): Theme {
  return resolveTheme(themeChoice(), window.matchMedia(DARK_QUERY).matches);
}

export function chooseTheme(choice: ThemeChoice) {
  try {
    if (choice === "system") {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      window.localStorage.setItem(THEME_STORAGE_KEY, choice);
    }
  } catch (cause: unknown) {
    console.error("The theme could not be saved.", cause);
  }

  if (choice === "system") {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = choice;
  }
}
