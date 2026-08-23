import type { ExpressionSpecification, FilterSpecification } from "mapbox-gl";
import { COUNTRY_STATES, STATE_COLORS } from "@/lib/colors";
import type { Marks } from "@/lib/colors";

export const SOURCE_ID = "country-boundaries";
export const COUNTRY_SOURCE_LAYER = "country_boundaries";
export const FILL_LAYER_ID = "country-fill";
export const BORDER_LAYER_ID = "country-border";
export const ISO_PROPERTY = "iso_3166_1_alpha_3";

// Mapbox's documented worldview filter, US perspective: keep non-disputed
// boundaries, plus disputed ones whose worldview list includes "US".
export const WORLDVIEW_FILTER: FilterSpecification = [
  "all",
  ["==", ["get", "disputed"], "false"],
  ["any", ["==", "all", ["get", "worldview"]], ["in", "US", ["get", "worldview"]]],
];

// Builds a `match` expression grouping codes by state so each state is a
// single case, falling back to STATE_COLORS.unmarked for everything else.
export function buildFillColorExpression(marks: Marks): ExpressionSpecification | string {
  const groups = new Map<string, string[]>();
  for (const [code, state] of Object.entries(marks)) {
    const group = groups.get(state);
    if (group) {
      group.push(code);
    } else {
      groups.set(state, [code]);
    }
  }

  const cases: (string | string[])[] = [];
  for (const state of COUNTRY_STATES) {
    const codes = groups.get(state);
    if (codes && codes.length > 0) {
      cases.push(codes, STATE_COLORS[state]);
    }
  }

  if (cases.length === 0) return STATE_COLORS.unmarked;

  return [
    "match",
    ["get", ISO_PROPERTY],
    ...cases,
    STATE_COLORS.unmarked,
  ] as unknown as ExpressionSpecification;
}
