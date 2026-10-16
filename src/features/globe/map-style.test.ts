import { describe, expect, test } from "bun:test";
import { expression, featureFilter } from "mapbox-gl/dist/style-spec/index.es.js";
import { STATE_COLORS } from "@/features/marks";
import { buildFillColorExpression, buildSelectedFilter } from "@/features/globe/map-style";

const KOSOVO_TILESET_FEATURE = {
  type: 3,
  properties: {
    iso_3166_1_alpha_3: "XKS",
    name_en: "Kosovo",
    disputed: "false",
    worldview: "all",
  },
} as const;

const UNCODED_TILESET_FEATURE = {
  type: 3,
  properties: { name_en: "Uncoded", disputed: "false", worldview: "all" },
} as const;

const GLOBE_ZOOM = { zoom: 3 };

function fillColorOf(
  fillColor: ReturnType<typeof buildFillColorExpression>,
  feature: typeof KOSOVO_TILESET_FEATURE | typeof UNCODED_TILESET_FEATURE = KOSOVO_TILESET_FEATURE,
): string {
  const parsed = expression.createExpression(fillColor);

  if (parsed.result === "error") throw new Error(parsed.value.map(String).join("\n"));

  const color: unknown = parsed.value.evaluate(GLOBE_ZOOM, feature);

  return String(color);
}

describe("Kosovo on the globe", () => {
  test("a UNK mark colours the tileset's XKS feature", () => {
    expect(fillColorOf(buildFillColorExpression({ UNK: "visited" }))).toBe(STATE_COLORS.visited);
  });

  test("selecting UNK outlines the tileset's XKS feature", () => {
    const { filter } = featureFilter(buildSelectedFilter("UNK"));

    expect(filter(GLOBE_ZOOM, KOSOVO_TILESET_FEATURE)).toBe(true);
  });
});

describe("a tileset feature with no country code", () => {
  test("stays unmarked", () => {
    expect(fillColorOf(buildFillColorExpression({ UNK: "visited" }), UNCODED_TILESET_FEATURE)).toBe(
      STATE_COLORS.unmarked,
    );
  });

  test("is not outlined when nothing is selected", () => {
    const { filter } = featureFilter(buildSelectedFilter(null));

    expect(filter(GLOBE_ZOOM, UNCODED_TILESET_FEATURE)).toBe(false);
  });
});
