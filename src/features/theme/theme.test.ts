import { expect, test } from "bun:test";
import {
  parseThemeChoice,
  resolveTheme,
  THEME_SCRIPT,
  THEME_STORAGE_KEY,
} from "@/features/theme/theme";

test("an unknown or missing stored value follows the system", () => {
  expect(parseThemeChoice(null)).toBe("system");
  expect(parseThemeChoice(undefined)).toBe("system");
  expect(parseThemeChoice("sepia")).toBe("system");
});

test("a stored light or dark value is kept", () => {
  expect(parseThemeChoice("light")).toBe("light");
  expect(parseThemeChoice("dark")).toBe("dark");
});

test("the system choice resolves to the device preference", () => {
  expect(resolveTheme("system", true)).toBe("dark");
  expect(resolveTheme("system", false)).toBe("light");
});

test("an explicit choice wins over the device preference", () => {
  expect(resolveTheme("light", true)).toBe("light");
  expect(resolveTheme("dark", false)).toBe("dark");
});

test("the script reads the same storage key the store writes", () => {
  expect(THEME_SCRIPT).toContain(`localStorage.getItem("${THEME_STORAGE_KEY}")`);
});
