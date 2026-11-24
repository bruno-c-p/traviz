"use client";

import { useEffect, useRef } from "react";
import type { Globe } from "@/features/globe/create-globe";
import { ZoomControls } from "@/features/globe/zoom-controls";
import { STATE_COLORS } from "@/features/marks";
import { loadGlobe } from "@/features/globe/load-globe";
import { mountGlobe } from "@/features/globe/mount-globe";

if (typeof window !== "undefined") void loadGlobe();

export function MapCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Globe | null>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) return;

    let isCancelled = false;
    let unmount: (() => void) | undefined;

    loadGlobe()
      .then((globeModules) => {
        if (isCancelled || !globeModules) return;

        const globe = mountGlobe(globeModules, container);

        mapRef.current = globe.map;
        unmount = () => {
          mapRef.current = null;
          globe.unmount();
        };
      })
      .catch((cause: unknown) => {
        console.error("The globe could not start.", cause);
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
        data-globe
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
