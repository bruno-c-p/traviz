"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { usePathname } from "next/navigation";
import type { Map as MapboxMap } from "mapbox-gl";
import { useEffect, useRef } from "react";
import { ZoomControls } from "@/features/globe/zoom-controls";
import { STATE_COLORS } from "@/features/marks";
import { mountGlobe } from "@/features/globe/mount-globe";
import { homePath } from "@/paths";

const mapboxModulePromise =
  typeof window === "undefined" || !process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    ? null
    : import("mapbox-gl").catch((cause: unknown) => {
        console.error("The map could not load.", cause);

        return null;
      });

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
    let unmount: (() => void) | undefined;

    mapboxModulePromise
      ?.then((mapboxModule) => {
        if (isCancelled || !mapboxModule) return;

        const globe = mountGlobe(mapboxModule.default, container, () => isMapRouteRef.current);

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
      {isMapRoute && (
        <ZoomControls
          onZoomIn={() => mapRef.current?.zoomIn()}
          onZoomOut={() => mapRef.current?.zoomOut()}
          className="fixed bottom-24 right-6 z-30 hidden md:flex"
        />
      )}
    </>
  );
}
