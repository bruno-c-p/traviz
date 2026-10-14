import type { ExpressionSpecification, FilterSpecification, StyleSpecification } from "mapbox-gl";
import countryLabels from "@/data/country-labels.json";
import { COUNTRY_STATES, STATE_COLORS } from "@/lib/colors";
import type { Marks } from "@/lib/colors";

export const SOURCE_ID = "country-boundaries";
export const COUNTRY_SOURCE_LAYER = "country_boundaries";
export const FILL_LAYER_ID = "country-fill";
export const BORDER_LAYER_ID = "country-border";
export const ISO_PROPERTY = "iso_3166_1_alpha_3";

const WATER_COLOR = "hsl(220, 1%, 86%)";
const LABEL_COLOR = "hsl(220, 1%, 49%)";
const LABEL_HALO_COLOR = "hsl(220, 0%, 100%)";
const LABEL_FONT = ["DIN Pro Medium"];
const ATTRIBUTION = [
  '<a href="https://www.mapbox.com/about/maps" target="_blank" title="Mapbox" aria-label="Mapbox">&copy; Mapbox</a>',
  '<a href="https://www.openstreetmap.org/copyright/" target="_blank" title="OpenStreetMap" aria-label="OpenStreetMap">&copy; OpenStreetMap</a>',
  '<a class="mapbox-improve-map" href="https://www.mapbox.com/contribute/" target="_blank" title="Improve this map" aria-label="Improve this map">Improve this map</a>',
].join(" ");

const CONTINENT_LABELS = [
  { name: "North America", coordinates: [-100, 47] },
  { name: "South America", coordinates: [-58, -15] },
  { name: "Europe", coordinates: [15, 50] },
  { name: "Africa", coordinates: [20, 5] },
  { name: "Asia", coordinates: [90, 45] },
  { name: "Oceania", coordinates: [135, -25] },
];

function pointCollection(points: { name: string; coordinates: number[]; area?: number }[]) {
  return {
    type: "FeatureCollection" as const,
    features: points.map(({ coordinates, ...properties }) => ({
      type: "Feature" as const,
      properties,
      geometry: { type: "Point" as const, coordinates },
    })),
  };
}

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

export function buildMapStyle(marks: Marks): StyleSpecification {
  return {
    version: 8,
    glyphs: "mapbox://fonts/mapbox/{fontstack}/{range}.pbf",
    projection: { name: "globe" },
    fog: {
      range: [-1, 10],
      color: "hsla(0, 0%, 100%, 0.2)",
      "high-color": "hsl(0, 0%, 100%)",
      "space-color": "hsl(0, 0%, 100%)",
      "horizon-blend": 0.1,
      "star-intensity": 0,
    },
    sources: {
      [SOURCE_ID]: {
        type: "vector",
        url: "mapbox://mapbox.country-boundaries-v1",
        attribution: ATTRIBUTION,
      },
      "country-labels": { type: "geojson", data: pointCollection(countryLabels) },
      "continent-labels": { type: "geojson", data: pointCollection(CONTINENT_LABELS) },
    },
    layers: [
      { id: "water", type: "background", paint: { "background-color": WATER_COLOR } },
      {
        id: FILL_LAYER_ID,
        type: "fill",
        source: SOURCE_ID,
        "source-layer": COUNTRY_SOURCE_LAYER,
        filter: WORLDVIEW_FILTER,
        paint: { "fill-color": buildFillColorExpression(marks), "fill-opacity": 1 },
      },
      {
        id: BORDER_LAYER_ID,
        type: "line",
        source: SOURCE_ID,
        "source-layer": COUNTRY_SOURCE_LAYER,
        filter: WORLDVIEW_FILTER,
        paint: {
          "line-color": "#868685",
          "line-width": ["interpolate", ["linear"], ["zoom"], 0, 0.4, 6, 1.2],
          "line-opacity": 0.6,
        },
      },
      {
        id: "country-label",
        type: "symbol",
        source: "country-labels",
        minzoom: 1,
        layout: {
          "text-field": ["get", "name"],
          "text-font": LABEL_FONT,
          "text-size": [
            "interpolate",
            ["cubic-bezier", 0.2, 0, 0.7, 1],
            ["zoom"],
            1,
            ["step", ["get", "area"], 8, 200000, 9, 1000000, 11],
            9,
            ["step", ["get", "area"], 17, 200000, 19, 1000000, 22],
          ],
          "text-line-height": 1.1,
          "text-max-width": 6,
          "symbol-sort-key": ["-", ["get", "area"]],
        },
        paint: {
          "text-color": LABEL_COLOR,
          "text-halo-color": LABEL_HALO_COLOR,
          "text-halo-width": 1.25,
        },
      },
      {
        id: "continent-label",
        type: "symbol",
        source: "continent-labels",
        minzoom: 0.75,
        maxzoom: 3,
        layout: {
          "text-field": ["get", "name"],
          "text-font": LABEL_FONT,
          "text-size": ["interpolate", ["exponential", 0.5], ["zoom"], 0, 10, 2.5, 15],
          "text-transform": "uppercase",
          "text-letter-spacing": 0.05,
          "text-line-height": 1.1,
          "text-max-width": 6,
        },
        paint: {
          "text-color": LABEL_COLOR,
          "text-halo-color": LABEL_HALO_COLOR,
          "text-halo-width": 1.5,
          "text-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.8, 1.5, 0.5, 2.5, 0],
        },
      },
    ],
  };
}
