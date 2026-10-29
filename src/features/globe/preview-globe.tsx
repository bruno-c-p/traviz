"use client";

import { useEffect, useRef } from "react";
import type { Globe } from "@/features/globe/create-globe";
import type { LngLat } from "@/features/globe/globe-camera";
import { loadGlobe } from "@/features/globe/load-globe";
import { startPreviewGlobe } from "@/features/globe/preview-globe-driver";
import { countryCenter } from "@/features/countries";
import type { Marks } from "@/features/marks";

type PreviewGlobeProps = {
  marks: Marks;
  focus: { code: string } | null;
  initialCenter: LngLat;
  className?: string;
};

type Preview = { globe: Globe; focus: (center: LngLat) => void };

export function PreviewGlobe({ marks, focus, initialCenter, className }: PreviewGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<Preview | null>(null);
  const marksRef = useRef(marks);
  const initialCenterRef = useRef(initialCenter);

  useEffect(() => {
    marksRef.current = marks;
    previewRef.current?.globe.setMarks(marks);
  }, [marks]);

  useEffect(() => {
    const center = focus ? countryCenter(focus.code) : null;

    if (center) previewRef.current?.focus(center);
  }, [focus]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) return;

    let isCancelled = false;
    let stop: (() => void) | undefined;

    loadGlobe()
      .then((globeModules) => {
        if (isCancelled || !globeModules) return;

        const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        const globe = globeModules.createGlobe(container, globeModules.topology, {
          camera: { center: initialCenterRef.current, zoom: 1 },
          prefersReducedMotion,
          isInteractive: false,
        });

        const driver = startPreviewGlobe(globe, {
          frames: window,
          timers: window,
          prefersReducedMotion,
        });

        globe.setMarks(marksRef.current);
        previewRef.current = { globe, focus: driver.focus };
        stop = () => {
          previewRef.current = null;
          driver.stop();
        };
      })
      .catch((cause: unknown) => {
        console.error("The preview globe could not start.", cause);
      });

    return () => {
      isCancelled = true;
      stop?.();
    };
  }, []);

  return <div ref={containerRef} aria-hidden="true" className={className} />;
}
