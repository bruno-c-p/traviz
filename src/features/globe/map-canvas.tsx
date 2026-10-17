"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import type { Map as MapboxMap } from "mapbox-gl";
import { useEffect, useRef } from "react";
import { ZoomControls } from "@/features/globe/zoom-controls";
import { STATE_COLORS } from "@/features/marks";
import { mountGlobe } from "@/features/globe/mount-globe";

let mapboxModulePromise: Promise<typeof import("mapbox-gl") | null> | null = null;

function loadMapbox() {
  if (typeof window === "undefined" || !process.env.NEXT_PUBLIC_MAPBOX_TOKEN) return null;

  mapboxModulePromise ??= import("mapbox-gl").catch((cause: unknown) => {
    console.error("The map could not load.", cause);
    mapboxModulePromise = null;

    return null;
  });

  return mapboxModulePromise;
}

export function MapCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) return;

    let isCancelled = false;
    let unmount: (() => void) | undefined;

    loadMapbox()
      ?.then((mapboxModule) => {
        if (isCancelled || !mapboxModule) return;

        const globe = mountGlobe(mapboxModule.default, container);

        mapRef.current = globe.map;
        unmount = () => {
          mapRef.current = null;
          globe.unmount();
        };
      })
      .catch((cause: unknown) => {
        console.error("The map could not start.", cause);
      });

    return () => {
      isCancelled = true;
      unmount?.();
    };
  }, []);

  return (
    <>
      <div
        ref={containerRef}
        className="h-full w-full"
        style={{ backgroundColor: STATE_COLORS.unmarked }}
      />
      <ZoomControls
        onZoomIn={() => mapRef.current?.zoomIn()}
        onZoomOut={() => mapRef.current?.zoomOut()}
        className="fixed bottom-24 right-6 z-30 hidden md:flex"
      />
    </>
  );
}
