"use client";

import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import countriesData from "@/data/countries.json";
import { STATE_COLORS } from "@/lib/colors";
import {
  BORDER_LAYER_ID,
  COUNTRY_SOURCE_LAYER,
  FILL_LAYER_ID,
  ISO_PROPERTY,
  SOURCE_ID,
  WORLDVIEW_FILTER,
  buildFillColorExpression,
} from "@/lib/mapStyle";
import type { Country } from "@/lib/stats";
import { useCountriesStore } from "@/store/countries";
import { FirstRunHint } from "@/components/FirstRunHint";
import { MarkPopover } from "@/components/MarkPopover";
import { homePath } from "@/paths";

const COUNTRIES_BY_CODE = new Map<string, Country>(
  (countriesData as Country[]).map((c) => [c.code, c]),
);
const KNOWN_CODES = new Set(COUNTRIES_BY_CODE.keys());

// Base style layers to strip: anything below "city level" (roads, POIs,
// transit, buildings). Country labels (and everything else — water, place
// labels, admin lines) are left alone. dark-v11 and light-v11 share the same
// underlying Streets tileset, so these source-layer/id patterns hold for
// both — but the loop below only ever calls removeLayer on layers that
// actually appear in the loaded style, so a style swap can't make it no-op
// silently or throw on a missing layer id. Removing (rather than hiding via
// `visibility: none`) stops the tile worker from bucketing these layers at
// all, which is the expensive part of every pan/zoom for a Streets-tileset
// style — hiding only skips the paint step.
const HIDE_SOURCE_LAYERS = new Set([
  "road",
  "bridge",
  "tunnel",
  "building",
  "poi_label",
  "transit_stop_label",
  "airport_label",
  "housenum_label",
]);
const HIDE_ID_PATTERN = /road|bridge|tunnel|building|poi|transit|airport/i;

const SPIN_DEGREES_PER_SECOND = 1.5;
const MAX_SPIN_FRAME_SECONDS = 0.1;

function tilesetFeatureName(properties: Record<string, unknown> | null | undefined): string {
  if (!properties) return "unknown";
  const name = properties.name_en ?? properties.name;
  return typeof name === "string" ? name : "unknown";
}

// mapbox-gl's bundled types model GeoJSONFeature as `extends GeoJSON.Feature`,
// but this project doesn't depend on @types/geojson, so `.properties` isn't
// visible on the declared type even though it's always present at runtime.
function featureProperties(feature: unknown): Record<string, unknown> | null {
  const properties = (feature as { properties?: unknown } | null | undefined)?.properties;
  return (properties as Record<string, unknown> | null | undefined) ?? null;
}

interface PopoverState {
  x: number;
  y: number;
  country: Country;
}

export function MapCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const pathname = usePathname();
  const isMapRouteRef = useRef(pathname === homePath());

  // The popover is anchored to a screen point; it doesn't make sense once
  // the user has navigated away from the map route.
  useEffect(() => {
    isMapRouteRef.current = pathname === homePath();
    if (pathname !== homePath()) setPopover(null);
  }, [pathname]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = new mapboxgl.Map({
      container,
      accessToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
      style: "mapbox://styles/mapbox/light-v11",
      projection: "globe",
      center: [0, 20],
      zoom: 1.4,
      minZoom: 1,
      maxZoom: 8,
    });

    (window as unknown as { __map: typeof map }).__map = map;
    let sweepDone = false;
    let unsubscribeMarks: (() => void) | undefined;

    let spinFrameId: number | null = null;
    let lastFrameTime: number | null = null;
    let stopped = false;

    function spinFrame(now: number) {
      const elapsedSeconds =
        lastFrameTime === null ? 0 : Math.min((now - lastFrameTime) / 1000, MAX_SPIN_FRAME_SECONDS);
      lastFrameTime = now;
      if (isMapRouteRef.current && elapsedSeconds > 0) {
        const center = map.getCenter();
        center.lng -= SPIN_DEGREES_PER_SECOND * elapsedSeconds;
        map.jumpTo({ center });
      }
      spinFrameId = requestAnimationFrame(spinFrame);
    }

    function stopSpin() {
      if (stopped) return;
      stopped = true;
      if (spinFrameId !== null) {
        cancelAnimationFrame(spinFrameId);
        spinFrameId = null;
      }
    }

    // Any click, drag, or zoom stops the spin permanently. `movestart`'s
    // `originalEvent` is only set for user-driven moves (mouse/touch/wheel),
    // never for our own programmatic `jumpTo` spin ticks, so this can't
    // confuse the two.
    map.on("click", stopSpin);
    map.on("mousedown", stopSpin);
    map.on("touchstart", stopSpin);
    map.on("wheel", stopSpin);
    map.on("movestart", (e) => {
      if (!e.originalEvent) return;
      stopSpin();
      setPopover(null);
    });

    map.on("style.load", () => {
      map.addSource(SOURCE_ID, {
        type: "vector",
        url: "mapbox://mapbox.country-boundaries-v1",
      });

      const firstSymbolId = map.getStyle()?.layers.find((l) => l.type === "symbol")?.id;

      map.addLayer(
        {
          id: FILL_LAYER_ID,
          type: "fill",
          source: SOURCE_ID,
          "source-layer": COUNTRY_SOURCE_LAYER,
          filter: WORLDVIEW_FILTER,
          paint: {
            "fill-color": buildFillColorExpression(useCountriesStore.getState().marks),
            "fill-opacity": 1,
          },
        },
        firstSymbolId,
      );

      map.addLayer(
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
        firstSymbolId,
      );

      for (const layer of map.getStyle()?.layers ?? []) {
        const sourceLayer = (layer as Record<string, unknown>)["source-layer"];
        const hide =
          (typeof sourceLayer === "string" && HIDE_SOURCE_LAYERS.has(sourceLayer)) ||
          HIDE_ID_PATTERN.test(layer.id);
        if (hide) {
          map.removeLayer(layer.id);
        }
      }

      map.on("mouseenter", FILL_LAYER_ID, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", FILL_LAYER_ID, () => {
        map.getCanvas().style.cursor = "";
      });

      map.on("click", FILL_LAYER_ID, (e) => {
        const feature = e.features?.[0];
        if (!feature) return;

        const properties = featureProperties(feature);
        const iso = properties?.[ISO_PROPERTY];
        const code = typeof iso === "string" ? iso : undefined;
        const country = code ? COUNTRIES_BY_CODE.get(code) : undefined;

        if (!code || !country) {
          console.warn(
            `[MapCanvas] Unmatched country code "${code ?? "?"}" (tileset name: "${tilesetFeatureName(properties)}") has no entry in countries.json — suppressing popover.`,
          );
          return;
        }

        const rect = container.getBoundingClientRect();
        setPopover({ x: rect.left + e.point.x, y: rect.top + e.point.y, country });
      });

      // One-time reconciliation sweep. Triggered off the source's own load
      // state (not `idle`) because the auto-rotate keeps the camera in
      // continuous motion, and `idle` never fires while a transition is
      // in progress.
      map.on("sourcedata", (e) => {
        if (sweepDone || e.sourceId !== SOURCE_ID || !e.isSourceLoaded) return;
        sweepDone = true;

        const rendered = map.queryRenderedFeatures({ layers: [FILL_LAYER_ID] });
        const seen = new Set<string>();
        const unmatched: string[] = [];

        for (const feature of rendered) {
          const properties = featureProperties(feature);
          const iso = properties?.[ISO_PROPERTY];
          const code = typeof iso === "string" ? iso : undefined;
          if (!code || seen.has(code)) continue;
          seen.add(code);
          if (!KNOWN_CODES.has(code)) {
            unmatched.push(`${code} (${tilesetFeatureName(properties)})`);
          }
        }

        console.warn(
          unmatched.length > 0
            ? `[MapCanvas] ISO reconciliation sweep — unmatched codes in rendered features: ${unmatched.join(", ")}`
            : "[MapCanvas] ISO reconciliation sweep — no unmatched codes in currently rendered features.",
        );
      });

      if (!stopped) spinFrameId = requestAnimationFrame(spinFrame);

      unsubscribeMarks = useCountriesStore.subscribe((state) => {
        map.setPaintProperty(FILL_LAYER_ID, "fill-color", buildFillColorExpression(state.marks));
      });
    });

    return () => {
      stopSpin();
      unsubscribeMarks?.();
      map.remove();
    };
  }, []);

  return (
    <>
      <div
        ref={containerRef}
        className="h-full w-full"
        style={{ backgroundColor: STATE_COLORS.unmarked }}
      />
      {popover && (
        <MarkPopover
          key={popover.country.code}
          anchor={{ x: popover.x, y: popover.y }}
          country={popover.country}
          onClose={() => setPopover(null)}
        />
      )}
      {pathname === homePath() && <FirstRunHint />}
    </>
  );
}
