import type {
  ExpressionSpecification,
  FilterSpecification,
  LayerSpecification,
  SourceSpecification,
  StyleSpecification,
} from "mapbox-gl";
import { countries } from "@/features/countries";
import { COUNTRY_STATES, STATE_COLORS } from "@/features/marks";
import type { Marks } from "@/features/marks";
import { ISO_PROPERTY, tilesetCodes } from "@/features/globe/tileset-feature";

export const SOURCE_ID = "country-boundaries";
const COUNTRY_SOURCE_LAYER = "country_boundaries";
export const FILL_LAYER_ID = "country-fill";
const BORDER_LAYER_ID = "country-border";
export const SELECTED_LAYER_ID = "country-selected";

const WATER_COLOR = "#d3d9cd";
const LABEL_COLOR = "#5e615c";
const LABEL_HALO_COLOR = "#ffffff";
const BORDER_COLOR = "#ffffff";
const SPACE_COLOR = "#f4f6f1";
const SELECTED_COLOR = "#0e0f0c";
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

const COUNTRY_LABELS = countries
  .filter((country) => country.hasGlobeLabel)
  .map(({ name, center, area }) => ({ name, coordinates: [...center], area }));

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

const WORLDVIEW_FILTER: FilterSpecification = [
  "all",
  ["==", ["get", "disputed"], "false"],
  ["any", ["==", "all", ["get", "worldview"]], ["in", "US", ["get", "worldview"]]],
];

export function buildSelectedFilter(selectedCode: string | null): FilterSpecification {
  return [
    "all",
    WORLDVIEW_FILTER,
    ["in", ["get", ISO_PROPERTY], ["literal", selectedCode ? tilesetCodes(selectedCode) : []]],
  ];
}

function groupCodesByState(marks: Marks): Map<string, string[]> {
  const groups = new Map<string, string[]>();

  for (const [code, state] of Object.entries(marks)) {
    const group = groups.get(state);

    if (group) {
      group.push(code);
    } else {
      groups.set(state, [code]);
    }
  }

  return groups;
}

export function buildFillColorExpression(marks: Marks): ExpressionSpecification | string {
  const groups = groupCodesByState(marks);
  const cases: (string | string[])[] = [];

  for (const state of COUNTRY_STATES) {
    const codes = groups.get(state);

    if (codes && codes.length > 0) {
      cases.push(codes.flatMap(tilesetCodes), STATE_COLORS[state]);
    }
  }

  if (cases.length === 0) return STATE_COLORS.unmarked;

  return ["match", ["get", ISO_PROPERTY], ...cases, STATE_COLORS.unmarked];
}

const MAP_FOG: StyleSpecification["fog"] = {
  range: [-1, 10],
  color: "hsla(0, 0%, 100%, 0.2)",
  "high-color": SPACE_COLOR,
  "space-color": SPACE_COLOR,
  "horizon-blend": 0.1,
  "star-intensity": 0,
};

const MAP_SOURCES = {
  [SOURCE_ID]: {
    type: "vector",
    url: "mapbox://mapbox.country-boundaries-v1",
    attribution: ATTRIBUTION,
  },
  "country-labels": { type: "geojson", data: pointCollection(COUNTRY_LABELS) },
  "continent-labels": { type: "geojson", data: pointCollection(CONTINENT_LABELS) },
} satisfies Record<string, SourceSpecification>;

function buildCountryLayers(marks: Marks, selectedCode: string | null): LayerSpecification[] {
  return [
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
        "line-color": BORDER_COLOR,
        "line-width": ["interpolate", ["linear"], ["zoom"], 0, 0.6, 6, 1.6],
        "line-opacity": 0.9,
      },
    },
    {
      id: SELECTED_LAYER_ID,
      type: "line",
      source: SOURCE_ID,
      "source-layer": COUNTRY_SOURCE_LAYER,
      filter: buildSelectedFilter(selectedCode),
      paint: {
        "line-color": SELECTED_COLOR,
        "line-width": ["interpolate", ["linear"], ["zoom"], 0, 1.5, 6, 3],
      },
    },
  ];
}

const LABEL_LAYERS: LayerSpecification[] = [
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
];

export function buildMapStyle(marks: Marks, selectedCode: string | null): StyleSpecification {
  return {
    version: 8,
    glyphs: "mapbox://fonts/mapbox/{fontstack}/{range}.pbf",
    projection: { name: "globe" },
    fog: MAP_FOG,
    sources: MAP_SOURCES,
    layers: [
      { id: "water", type: "background", paint: { "background-color": WATER_COLOR } },
      ...buildCountryLayers(marks, selectedCode),
      ...LABEL_LAYERS,
    ],
  };
}
