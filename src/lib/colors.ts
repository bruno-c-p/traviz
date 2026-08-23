// Also doubles as the shared domain-type module (CountryState, Marks below):
// stats.ts must not import from the store, so those types live here instead.
export type CountryState = "visited" | "want" | "not_interested";

export type Marks = Record<string, CountryState>;

export const COUNTRY_STATES: readonly CountryState[] = ["visited", "want", "not_interested"];

export type StateColorKey = CountryState | "unmarked";

export const STATE_COLORS: Record<StateColorKey, string> = {
  visited: "#2ead4b",
  want: "#ffd11a",
  not_interested: "#868685",
  unmarked: "#e8ebe6",
};

// Text-safe variants of STATE_COLORS for use as `color` (not background/fill).
// The raw STATE_COLORS values are tuned to read well as fills/borders on the
// light UI, but `want` (yellow) falls short of WCAG AA (4.5:1) as text on
// white — these are deepened so any state-colored text stays AA-compliant
// while fills/borders keep using the true state color.
export const STATE_TEXT_COLORS: Record<StateColorKey, string> = {
  visited: "#054d28",
  want: "#b86700",
  not_interested: "#454745",
  unmarked: "#868685",
};
