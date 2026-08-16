import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import type { Map as MapboxMap } from "mapbox-gl";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const STORAGE_KEY = "traviz-countries";

// Mirrors src/lib/mapStyle.ts — read here rather than imported to keep this
// helper free of any runtime dependency on the mapbox-gl module graph.
const FILL_LAYER_ID = "country-fill";
const ISO_PROPERTY = "iso_3166_1_alpha_3";

export interface CountryFixture {
  code: string;
  name: string;
  flag: string;
  continent: string;
  counted: boolean;
}

export const COUNTRIES: CountryFixture[] = JSON.parse(
  readFileSync(path.resolve(__dirname, "../../src/data/countries.json"), "utf-8"),
);

export const KNOWN_CODES = COUNTRIES.map((c) => c.code);

export function countryByName(name: string): CountryFixture {
  const country = COUNTRIES.find((c) => c.name === name);
  if (!country) throw new Error(`No fixture country named "${name}"`);
  return country;
}

// Navigates to `path` and clears localStorage there. Deliberately not an
// addInitScript: that re-runs on every subsequent navigation within the
// test (including page.goto to another route, and page.reload), which would
// wipe out marks the test just made. A fresh Playwright browser context
// already starts with empty storage, so this is a one-time, explicit reset.
export async function resetAppStorage(page: Page, path = "/"): Promise<void> {
  await page.goto(path);
  await page.evaluate(() => window.localStorage.clear());
}

export async function readMarks(page: Page): Promise<Record<string, string>> {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed?.state?.marks ?? {};
  }, STORAGE_KEY);
}

export async function waitForMapReady(page: Page): Promise<void> {
  await page.waitForFunction(
    ({ layerId }) => {
      const map = (window as unknown as { __map?: MapboxMap }).__map;
      return !!map && map.isStyleLoaded() && !!map.getLayer(layerId);
    },
    { layerId: FILL_LAYER_ID },
    { timeout: 30_000 },
  );
}

// Country-agnostic: samples a grid of on-screen points and asks Mapbox
// (via the window.__map handle the app already exposes) which of them sit
// over a rendered country polygon whose ISO code we recognize. Never assumes
// which country ends up under a given pixel — the globe auto-rotates.
export async function findLandPixel(page: Page): Promise<{ x: number; y: number }> {
  const box = await page.locator(".mapboxgl-canvas").boundingBox();
  if (!box) throw new Error("Map canvas not found");

  const candidates: { x: number; y: number }[] = [];
  const cols = 16;
  const rows = 16;
  for (let r = 1; r < rows; r++) {
    for (let c = 1; c < cols; c++) {
      candidates.push({ x: box.x + (box.width * c) / cols, y: box.y + (box.height * r) / rows });
    }
  }

  const handle = await page.waitForFunction(
    ({ candidates, knownCodes, isoProp, layerId }) => {
      const map = (window as unknown as { __map?: MapboxMap }).__map;
      if (!map) return null;
      const rect = map.getCanvas().getBoundingClientRect();
      for (const p of candidates) {
        const features = map.queryRenderedFeatures([p.x - rect.left, p.y - rect.top], { layers: [layerId] });
        for (const f of features) {
          const iso = (f.properties as Record<string, unknown> | null)?.[isoProp];
          if (typeof iso === "string" && knownCodes.includes(iso)) return p;
        }
      }
      return null;
    },
    { candidates, knownCodes: KNOWN_CODES, isoProp: ISO_PROPERTY, layerId: FILL_LAYER_ID },
    { timeout: 20_000 },
  );

  const point = (await handle.jsonValue()) as { x: number; y: number } | null;
  if (!point) throw new Error("Could not find a land pixel on the visible globe");
  return point;
}

export function countryRow(page: Page, name: string) {
  return page.locator("div.flex.items-center.gap-3.border-b.border-slate-100").filter({ hasText: name });
}

export function listFilterBar(page: Page) {
  return page.locator('h1:has-text("List") + div');
}
