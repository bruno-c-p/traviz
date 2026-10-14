"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { usePathname } from "next/navigation";
import type { Map as MapboxMap } from "mapbox-gl";
import { useEffect, useRef } from "react";
import { ZoomControls } from "@/components/zoom-controls";
import { STATE_COLORS } from "@/lib/colors";
import { mountGlobe } from "@/lib/mount-globe";
import { homePath } from "@/paths";

const mapboxModulePromise = typeof window === "undefined" ? null : import("mapbox-gl");

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

    mapboxModulePromise?.then(({ default: mapbox }) => {
      if (isCancelled) return;

      const globe = mountGlobe(mapbox, container, () => isMapRouteRef.current);

      mapRef.current = globe.map;
      unmount = () => {
        mapRef.current = null;
        globe.unmount();
      };
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
