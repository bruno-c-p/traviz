// Also doubles as the shared domain-type module (CountryState, Marks below):
// stats.ts must not import from the store, so those types live here instead.
export type CountryState = "visited" | "want" | "not_interested";

export type Marks = Record<string, CountryState>;

export const COUNTRY_STATES: readonly CountryState[] = ["visited", "want", "not_interested"];

export type StateColorKey = CountryState | "unmarked";

export const STATE_COLORS: Record<StateColorKey, string> = {
  visited: "#0D9488",
  want: "#D97706",
  not_interested: "#94A3B8",
  unmarked: "#E2E8F0",
};

// Text-safe variants of STATE_COLORS for use as `color` (not background/fill).
// The raw STATE_COLORS values are tuned to read well as fills/borders on a
// light UI, but several fall short of WCAG AA (4.5:1) as text on a white
// surface — `want` in particular is only ~3.2:1. These are darkened so any
// state-colored text stays AA-compliant while fills/borders keep using the
// true state color.
export const STATE_TEXT_COLORS: Record<StateColorKey, string> = {
  visited: "#0F766E",
  want: "#B45309",
  not_interested: "#475569",
  unmarked: "#334155",
};
