import type { Map as MapboxMap } from "mapbox-gl";

const SPIN_DEGREES_PER_SECOND = 1.5;
const MAX_SPIN_FRAME_SECONDS = 0.1;

export function createGlobeSpin(map: MapboxMap, isSpinAllowed: () => boolean) {
  let spinFrameId: number | null = null;
  let lastFrameTime: number | null = null;
  let stopped = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function spinFrame(now: number) {
    const elapsedSeconds =
      lastFrameTime === null ? 0 : Math.min((now - lastFrameTime) / 1000, MAX_SPIN_FRAME_SECONDS);

    lastFrameTime = now;

    if (isSpinAllowed() && elapsedSeconds > 0) {
      const center = map.getCenter();
      center.lng -= SPIN_DEGREES_PER_SECOND * elapsedSeconds;
      map.jumpTo({ center });
    }

    spinFrameId = requestAnimationFrame(spinFrame);
  }

  function start() {
    if (!stopped) spinFrameId = requestAnimationFrame(spinFrame);
  }

  function stop() {
    if (stopped) return;
    stopped = true;

    if (spinFrameId !== null) {
      cancelAnimationFrame(spinFrameId);
      spinFrameId = null;
    }
  }

  function stopOnUserInteraction() {
    map.on("click", stop);
    map.on("mousedown", stop);
    map.on("touchstart", stop);
    map.on("wheel", stop);
    map.on("movestart", (event) => {
      if (!event.originalEvent) return;
      stop();
    });
  }

  return { start, stop, stopOnUserInteraction };
}
