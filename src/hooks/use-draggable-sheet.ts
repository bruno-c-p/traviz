import { useRef } from "react";
import type { PointerEvent } from "react";
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

export function useDraggableSheet() {
  const clearSelection = useSelectedCountryStore((state) => state.clearSelection);
  const sheetRef = useRef<HTMLDialogElement>(null);
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

  return {
    sheetRef,
    backdropRef,
    close,
    sheetHandlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerEnd,
      onPointerCancel: handlePointerEnd,
    },
  };
}
