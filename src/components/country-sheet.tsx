"use client";

import { useId, useRef } from "react";
import type { PointerEvent } from "react";
import { createPortal } from "react-dom";
import { ClearMarkButton } from "@/components/clear-mark-button";
import { CountryHeading } from "@/components/country-heading";
import { MarkChoices } from "@/components/mark-choices";
import type { Country } from "@/lib/stats";
import { useSelectedCountryStore } from "@/store/selected-country";

const DRAG_START_DISTANCE = 4;
const DISMISS_DISTANCE_RATIO = 0.25;
const DISMISS_VELOCITY = 0.11;
const UPWARD_DRAG_FRICTION = 2;
const EXIT_ANIMATION: KeyframeAnimationOptions = {
  duration: 200,
  easing: "cubic-bezier(0.23, 1, 0.32, 1)",
  fill: "forwards",
};

type SheetDrag = {
  pointerId: number;
  startY: number;
  startTime: number;
  offset: number;
  isDragging: boolean;
};

export function CountrySheet({ country }: { country: Country }) {
  const headingId = useId();
  const clearSelection = useSelectedCountryStore((state) => state.clearSelection);
  const sheetRef = useRef<HTMLElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<SheetDrag | null>(null);
  const isClosingRef = useRef(false);

  function close() {
    const sheet = sheetRef.current;
    const backdrop = backdropRef.current;
    if (!sheet || !backdrop || isClosingRef.current) return;
    isClosingRef.current = true;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sheetKeyframes = prefersReducedMotion
      ? { opacity: [getComputedStyle(sheet).opacity, "0"] }
      : { translate: [getComputedStyle(sheet).translate, "0 100%"] };

    backdrop.animate({ opacity: [getComputedStyle(backdrop).opacity, "0"] }, EXIT_ANIMATION);
    sheet.animate(sheetKeyframes, EXIT_ANIMATION).onfinish = clearSelection;
  }

  function handlePointerDown(event: PointerEvent<HTMLElement>) {
    if (dragRef.current || isClosingRef.current) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startTime: event.timeStamp,
      offset: 0,
      isDragging: false,
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const sheet = event.currentTarget;
    const distance = event.clientY - drag.startY;
    if (!drag.isDragging) {
      if (Math.abs(distance) < DRAG_START_DISTANCE) return;
      drag.isDragging = true;
      sheet.setPointerCapture(event.pointerId);
      sheet.style.transition = "none";
    }

    drag.offset = distance >= 0 ? distance : -Math.sqrt(-distance) * UPWARD_DRAG_FRICTION;
    sheet.style.translate = `0 ${drag.offset}px`;
  }

  function handlePointerEnd(event: PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (!drag.isDragging) return;

    const sheet = event.currentTarget;
    const velocity = drag.offset / (event.timeStamp - drag.startTime);
    const isDismissed =
      event.type === "pointerup" &&
      (drag.offset > sheet.offsetHeight * DISMISS_DISTANCE_RATIO || velocity > DISMISS_VELOCITY);

    if (isDismissed) {
      close();
      return;
    }
    sheet.style.transition = "";
    sheet.style.translate = "";
  }

  return createPortal(
    <div className="md:hidden">
      <div
        ref={backdropRef}
        aria-hidden
        className="fixed inset-0 z-[55] bg-ink/30 transition-opacity duration-300 ease-out starting:opacity-0"
        onClick={close}
      />
      <section
        ref={sheetRef}
        role="dialog"
        aria-labelledby={headingId}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        className="fixed inset-x-0 bottom-0 z-[60] flex touch-none flex-col gap-4 rounded-t-[28px] bg-canvas px-5 pt-3 shadow-card transition-[translate,opacity] duration-[400ms] ease-drawer after:absolute after:inset-x-0 after:top-[calc(100%-1px)] after:h-screen after:bg-canvas motion-safe:starting:translate-y-full motion-reduce:starting:opacity-0"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        <div aria-hidden className="mx-auto h-1 w-10 rounded-full bg-line" />
        <CountryHeading country={country} headingId={headingId} onClose={close} />
        <MarkChoices code={country.code} countryName={country.name} layout="rows" />
        <ClearMarkButton code={country.code} className="self-center" />
      </section>
    </div>,
    document.body,
  );
}
