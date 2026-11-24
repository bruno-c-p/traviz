"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useId, useSyncExternalStore } from "react";
import { THEME_CHOICES, THEME_LABELS } from "@/features/theme/theme";
import type { ThemeChoice } from "@/features/theme/theme";
import { chooseTheme, subscribeTheme, themeChoice } from "@/features/theme/theme-store";
import { cn } from "@/shared/cn";

const THEME_ICONS: Record<ThemeChoice, LucideIcon> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};

function serverThemeChoice(): ThemeChoice {
  return "system";
}

export function ThemePicker({ className }: { className?: string }) {
  const name = useId();
  const choice = useSyncExternalStore(subscribeTheme, themeChoice, serverThemeChoice);

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn("grid grid-cols-3 gap-1 rounded-full bg-canvas-soft p-1", className)}
    >
      {THEME_CHOICES.map((option) => {
        const Icon = THEME_ICONS[option];

        return (
          <label
            key={option}
            className="pressable flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full px-3 text-sm font-semibold text-body hover:text-ink has-checked:bg-canvas has-checked:text-ink has-checked:shadow-card has-focus-visible:ring-2 has-focus-visible:ring-ink"
          >
            <input
              type="radio"
              name={name}
              value={option}
              checked={choice === option}
              onChange={() => chooseTheme(option)}
              className="sr-only"
            />
            <Icon size={16} aria-hidden />
            {THEME_LABELS[option]}
          </label>
        );
      })}
    </div>
  );
}
