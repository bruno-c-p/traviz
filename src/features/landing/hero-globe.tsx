"use client";

import { PreviewGlobe } from "@/features/globe";
import { SAMPLE_CENTER } from "@/features/landing/landing-marks";
import { useLandingStore } from "@/features/landing/landing-store";

export function HeroGlobe() {
  const marks = useLandingStore((store) => store.marks);
  const focus = useLandingStore((store) => store.focus);

  return (
    <div className="relative size-full">
      <div className="absolute top-1/2 left-1/2 aspect-square h-[88%] max-w-full -translate-1/2 rounded-full bg-land" />
      <PreviewGlobe
        marks={marks}
        focus={focus}
        initialCenter={SAMPLE_CENTER}
        className="absolute inset-0"
      />
    </div>
  );
}
