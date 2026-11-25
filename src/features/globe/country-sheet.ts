import { EXIT_MS, afterExit } from "@/features/globe/sheet-exit";
import { dragOffset, isDismissingDrag, isDragStart } from "@/features/globe/sheet-drag";

const EXIT_ANIMATION: KeyframeAnimationOptions = {
  duration: EXIT_MS,
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

export type CountrySheet = {
  readonly show: () => void;
  readonly hide: () => void;
  readonly close: () => void;
};

export function mountCountrySheet(wrapper: HTMLElement, onExit: () => void): CountrySheet | null {
  const sheet = wrapper.querySelector<HTMLElement>("[data-sheet-panel]");
  const backdrop = wrapper.querySelector<HTMLElement>("[data-sheet-backdrop]");

  if (sheet === null || backdrop === null) return null;

  let drag: SheetDrag | null = null;
  let isClosing = false;
  let exitAnimations: Animation[] = [];

  const reset = () => {
    for (const animation of exitAnimations) animation.cancel();

    exitAnimations = [];
    isClosing = false;
    drag = null;
    sheet.style.transition = "";
    sheet.style.translate = "";
  };

  const close = () => {
    if (isClosing || wrapper.hidden) return;

    isClosing = true;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const sheetKeyframes = prefersReducedMotion
      ? { opacity: [getComputedStyle(sheet).opacity, "0"] }
      : { translate: [getComputedStyle(sheet).translate, "0 100%"] };

    const backdropExit = backdrop.animate(
      { opacity: [getComputedStyle(backdrop).opacity, "0"] },
      EXIT_ANIMATION,
    );

    const sheetExit = sheet.animate(sheetKeyframes, EXIT_ANIMATION);

    exitAnimations = [backdropExit, sheetExit];
    afterExit(sheetExit.finished, window, onExit);
  };

  const endDrag = (event: PointerEvent) => {
    const ended = drag;

    if (ended === null || ended.pointerId !== event.pointerId) return;

    drag = null;

    if (!ended.isDragging) return;

    const isDismissed =
      event.type === "pointerup" &&
      isDismissingDrag(ended.offset, sheet.offsetHeight, event.timeStamp - ended.startTime);

    if (isDismissed) {
      close();

      return;
    }

    sheet.style.transition = "";
    sheet.style.translate = "";
  };

  sheet.addEventListener("pointerdown", (event) => {
    if (drag !== null || isClosing) return;

    drag = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startTime: event.timeStamp,
      offset: 0,
      isDragging: false,
    };
  });

  sheet.addEventListener("pointermove", (event) => {
    if (drag === null || drag.pointerId !== event.pointerId) return;

    const distance = event.clientY - drag.startY;

    if (!drag.isDragging) {
      if (!isDragStart(distance)) return;

      drag.isDragging = true;
      sheet.setPointerCapture(event.pointerId);
      sheet.style.transition = "none";
    }

    drag.offset = dragOffset(distance);
    sheet.style.translate = `0 ${drag.offset}px`;
  });

  sheet.addEventListener("pointerup", endDrag);
  sheet.addEventListener("pointercancel", endDrag);
  backdrop.addEventListener("click", close);

  return {
    show: () => {
      wrapper.hidden = false;
    },
    hide: () => {
      if (wrapper.hidden) return;

      wrapper.hidden = true;
      reset();
    },
    close,
  };
}
