"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { usePathname } from "next/navigation";
import type { Map as MapboxMap } from "mapbox-gl";
import { useEffect, useRef } from "react";
import { ZoomControls } from "@/components/zoom-controls";
import { STATE_COLORS } from "@/lib/colors";
import { COUNTRIES_BY_CODE, countryCenter } from "@/lib/countries";
import {
  FILL_LAYER_ID,
  ISO_PROPERTY,
  SELECTED_LAYER_ID,
  SOURCE_ID,
  buildFillColorExpression,
  buildMapStyle,
  buildSelectedFilter,
} from "@/lib/mapStyle";
import { useCountriesStore } from "@/store/countries";
import { useSelectedCountryStore } from "@/store/selected-country";
import { homePath } from "@/paths";

const FLY_TO_ZOOM = 3;
const KNOWN_CODES = new Set(COUNTRIES_BY_CODE.keys());

const mapboxModulePromise = typeof window === "undefined" ? null : import("mapbox-gl");

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

export function MapCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const pathname = usePathname();
  const isMapRoute = pathname === homePath();
  const isMapRouteRef = useRef(isMapRoute);

  useEffect(() => {
    isMapRouteRef.current = isMapRoute;
  }, [isMapRoute]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let isCancelled = false;
    let teardown: (() => void) | undefined;

    mapboxModulePromise?.then(({ default: mapboxgl }) => {
      if (isCancelled) return;

      const initialMarks = useCountriesStore.getState().marks;
      const initialSelectedCode = useSelectedCountryStore.getState().selectedCode;
      const map = new mapboxgl.Map({
        container,
        accessToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
        style: buildMapStyle(initialMarks, initialSelectedCode),
        localFontFamily: getComputedStyle(container).fontFamily,
        projection: "globe",
        center: [0, 20],
        zoom: 1.4,
        minZoom: 1,
        maxZoom: 8,
      });

      mapRef.current = map;
      let sweepDone = false;
      let unsubscribeMarks: (() => void) | undefined;
      let unsubscribeSelection: (() => void) | undefined;

      let spinFrameId: number | null = null;
      let lastFrameTime: number | null = null;
      let stopped = false;

      function spinFrame(now: number) {
        const elapsedSeconds =
          lastFrameTime === null
            ? 0
            : Math.min((now - lastFrameTime) / 1000, MAX_SPIN_FRAME_SECONDS);
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
      });

      map.on("style.load", () => {
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
              `[MapCanvas] Unmatched country code "${code ?? "?"}" (tileset name: "${tilesetFeatureName(properties)}") has no entry in countries.json — ignoring the click.`,
            );
            return;
          }

          useSelectedCountryStore.getState().select(country.code);
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

        const currentMarks = useCountriesStore.getState().marks;
        if (currentMarks !== initialMarks) {
          map.setPaintProperty(FILL_LAYER_ID, "fill-color", buildFillColorExpression(currentMarks));
        }

        unsubscribeMarks = useCountriesStore.subscribe((state) => {
          map.setPaintProperty(FILL_LAYER_ID, "fill-color", buildFillColorExpression(state.marks));
        });

        map.setFilter(
          SELECTED_LAYER_ID,
          buildSelectedFilter(useSelectedCountryStore.getState().selectedCode),
        );

        unsubscribeSelection = useSelectedCountryStore.subscribe((state, previousState) => {
          if (state.selectedCode !== previousState.selectedCode) {
            map.setFilter(SELECTED_LAYER_ID, buildSelectedFilter(state.selectedCode));
            if (state.selectedCode) stopSpin();
          }
          if (state.flyRequest && state.flyRequest !== previousState.flyRequest) {
            const center = countryCenter(state.flyRequest.code);
            if (center) {
              stopSpin();
              map.flyTo({ center, zoom: Math.max(map.getZoom(), FLY_TO_ZOOM) });
            }
          }
        });
      });

      teardown = () => {
        stopSpin();
        unsubscribeMarks?.();
        unsubscribeSelection?.();
        mapRef.current = null;
        map.remove();
      };
    });

    return () => {
      isCancelled = true;
      teardown?.();
    };
  }, []);

  return (
    <>
      <div
        ref={containerRef}
        className="h-full w-full"
        style={{ backgroundColor: STATE_COLORS.unmarked }}
      />
      {isMapRoute && (
        <ZoomControls
          onZoomIn={() => mapRef.current?.zoomIn()}
          onZoomOut={() => mapRef.current?.zoomOut()}
          className="fixed bottom-24 right-6 z-30 hidden md:flex signed-out:hidden"
        />
      )}
    </>
  );
}
