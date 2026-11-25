export type Theme = "light" | "dark";

export type ThemeChoice = Theme | "system";

export const THEME_CHOICES: readonly ThemeChoice[] = ["system", "light", "dark"];

export const THEME_LABELS: Record<ThemeChoice, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

export const THEME_STORAGE_KEY = "traviz-theme";

const applyStoredTheme = `function(theme){if(theme==="light"||theme==="dark")document.documentElement.dataset.theme=theme;else delete document.documentElement.dataset.theme}`;

export const THEME_SCRIPT = `(function(apply){try{apply(localStorage.getItem("${THEME_STORAGE_KEY}"))}catch(cause){}addEventListener("storage",function(event){if(event.key==="${THEME_STORAGE_KEY}")apply(event.newValue)})})(${applyStoredTheme})`;

export function parseThemeChoice(value: string | null | undefined): ThemeChoice {
  return value === "light" || value === "dark" ? value : "system";
}

export function resolveTheme(choice: ThemeChoice, prefersDark: boolean): Theme {
  if (choice !== "system") return choice;

  return prefersDark ? "dark" : "light";
}
