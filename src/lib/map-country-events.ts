import type { Map as MapboxMap } from "mapbox-gl";
import { COUNTRIES_BY_CODE } from "@/lib/countries";
import { FILL_LAYER_ID, SOURCE_ID } from "@/lib/mapStyle";
import { readTilesetFeature } from "@/lib/tileset-feature";
import { useSelectedCountryStore } from "@/store/selected-country";

const KNOWN_CODES = new Set(COUNTRIES_BY_CODE.keys());

function bindPointerCursor(map: MapboxMap) {
  map.on("mouseenter", FILL_LAYER_ID, () => {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", FILL_LAYER_ID, () => {
    map.getCanvas().style.cursor = "";
  });
}

function bindCountryClick(map: MapboxMap) {
  map.on("click", FILL_LAYER_ID, (event) => {
    const feature = event.features?.[0];

    if (!feature) return;

    const { code, name } = readTilesetFeature(feature);
    const country = code ? COUNTRIES_BY_CODE.get(code) : undefined;

    if (!code || !country) {
      console.warn(
        `[MapCanvas] Unmatched country code "${code ?? "?"}" (tileset name: "${name}") has no entry in countries.json — ignoring the click.`,
      );

      return;
    }

    useSelectedCountryStore.getState().select(country.code);
  });
}

function collectUnmatchedCodes(map: MapboxMap): string[] {
  const rendered = map.queryRenderedFeatures({ layers: [FILL_LAYER_ID] });
  const seen = new Set<string>();
  const unmatched: string[] = [];

  for (const feature of rendered) {
    const { code, name } = readTilesetFeature(feature);

    if (!code || seen.has(code)) continue;
    seen.add(code);

    if (!KNOWN_CODES.has(code)) {
      unmatched.push(`${code} (${name})`);
    }
  }

  return unmatched;
}

// One-time reconciliation sweep. Triggered off the source's own load
// state (not `idle`) because the auto-rotate keeps the camera in
// continuous motion, and `idle` never fires while a transition is
// in progress.
function bindReconciliationSweep(map: MapboxMap) {
  let sweepDone = false;

  map.on("sourcedata", (event) => {
    if (sweepDone || event.sourceId !== SOURCE_ID || !event.isSourceLoaded) return;
    sweepDone = true;

    const unmatched = collectUnmatchedCodes(map);

    console.warn(
      unmatched.length > 0
        ? `[MapCanvas] ISO reconciliation sweep — unmatched codes in rendered features: ${unmatched.join(", ")}`
        : "[MapCanvas] ISO reconciliation sweep — no unmatched codes in currently rendered features.",
    );
  });
}

export function bindCountryEvents(map: MapboxMap) {
  bindPointerCursor(map);
  bindCountryClick(map);
  bindReconciliationSweep(map);
}
