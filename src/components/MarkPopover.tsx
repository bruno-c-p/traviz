"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Country } from "@/lib/stats";
import { StateButtons } from "@/components/StateButtons";

const MOBILE_QUERY = "(max-width: 767px)";
const EDGE_MARGIN = 12;
const POINT_OFFSET = 14;

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}

interface MarkPopoverProps {
  country: Country;
  anchor: { x: number; y: number };
  onClose: () => void;
}

export function MarkPopover({ country, anchor, onClose }: MarkPopoverProps) {
  const isMobile = useIsMobile();
  const cardRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({
    left: anchor.x,
    top: anchor.y,
    visibility: "hidden",
  });

  // Outside click + Esc close the popover. Genuine map movement is handled
  // by MapCanvas itself (it owns the map instance and calls onClose there).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onPointerDown(e: PointerEvent) {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [onClose]);

  useLayoutEffect(() => {
    if (isMobile) return;
    const el = cardRef.current;
    if (!el) return;

    const { offsetWidth: w, offsetHeight: h } = el;
    const flipX = anchor.x + POINT_OFFSET + w + EDGE_MARGIN > window.innerWidth;
    const flipY = anchor.y + POINT_OFFSET + h + EDGE_MARGIN > window.innerHeight;

    let left = flipX ? anchor.x - POINT_OFFSET - w : anchor.x + POINT_OFFSET;
    let top = flipY ? anchor.y - POINT_OFFSET - h : anchor.y + POINT_OFFSET;

    left = Math.min(
      Math.max(left, EDGE_MARGIN),
      Math.max(EDGE_MARGIN, window.innerWidth - w - EDGE_MARGIN),
    );
    top = Math.min(
      Math.max(top, EDGE_MARGIN),
      Math.max(EDGE_MARGIN, window.innerHeight - h - EDGE_MARGIN),
    );

    setStyle({ left, top, visibility: "visible" });
  }, [anchor.x, anchor.y, isMobile]);

  if (isMobile) {
    return (
      <>
        <div className="fixed inset-0 z-[55] bg-black/50" aria-hidden="true" />
        <div
          ref={cardRef}
          role="dialog"
          aria-label={`Mark ${country.name}`}
          className="fixed inset-x-0 bottom-0 z-[60] rounded-t-2xl bg-canvas p-5 shadow-2xl"
          style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
        >
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-canvas-soft" />
          <div className="mb-4 flex items-center gap-3">
            <span className="text-3xl leading-none">{country.flag}</span>
            <span className="text-lg font-semibold text-ink">{country.name}</span>
          </div>
          <StateButtons code={country.code} size="md" />
        </div>
      </>
    );
  }

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-label={`Mark ${country.name}`}
      style={style}
      className="fixed z-[60] w-max max-w-[calc(100vw-1rem)] rounded-xl bg-canvas/95 p-4 shadow-2xl backdrop-blur-md"
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="text-2xl leading-none">{country.flag}</span>
        <span className="text-base font-semibold text-ink">{country.name}</span>
      </div>
      <StateButtons code={country.code} size="md" />
    </div>
  );
}
