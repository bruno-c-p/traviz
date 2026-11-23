export type CountryState = "visited" | "want" | "not_interested";

export type Marks = Record<string, CountryState>;

export const COUNTRY_STATES: readonly CountryState[] = ["visited", "want", "not_interested"];

export type StateColorKey = CountryState | "unmarked";

export const STATE_COLORS: Record<StateColorKey, string> = {
  visited: "var(--color-primary)",
  want: "var(--color-want)",
  not_interested: "var(--color-skip)",
  unmarked: "var(--color-land)",
};

export const STATE_ON_COLORS: Record<StateColorKey, string> = {
  visited: "var(--color-on-primary)",
  want: "#ffffff",
  not_interested: "var(--color-ink)",
  unmarked: "var(--color-ink)",
};

export const STATE_LABELS: Record<CountryState, string> = {
  visited: "Visited",
  want: "Want to go",
  not_interested: "Not interested",
};

export const STATE_SHORT_LABELS: Record<CountryState, string> = {
  visited: "Visited",
  want: "Want",
  not_interested: "Skip",
};

export const STATE_HINTS: Record<CountryState, string> = {
  visited: "Been there",
  want: "Add it to the wish list",
  not_interested: "Leave it off your plans",
};
