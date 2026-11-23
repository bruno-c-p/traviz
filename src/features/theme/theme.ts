export type Theme = "light" | "dark";

export type ThemeChoice = Theme | "system";

export const THEME_CHOICES: readonly ThemeChoice[] = ["system", "light", "dark"];

export const THEME_LABELS: Record<ThemeChoice, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

export const THEME_STORAGE_KEY = "traviz-theme";

export const THEME_SCRIPT = `try{var theme=localStorage.getItem("${THEME_STORAGE_KEY}");if(theme==="light"||theme==="dark")document.documentElement.dataset.theme=theme}catch(cause){}`;

export function parseThemeChoice(value: string | null | undefined): ThemeChoice {
  return value === "light" || value === "dark" ? value : "system";
}

export function resolveTheme(choice: ThemeChoice, prefersDark: boolean): Theme {
  if (choice !== "system") return choice;

  return prefersDark ? "dark" : "light";
}
