const SPIN_DEGREES_PER_SECOND = 1.5;
const MAX_SPIN_FRAME_SECONDS = 0.1;

type SpinCenter = { lng: number; lat: number };

type SpinStopEvent = "click" | "mousedown" | "touchstart" | "wheel" | "zoomstart" | "movestart";

export type SpinnableMap = {
  getCenter: () => SpinCenter;
  jumpTo: (options: { center: SpinCenter }) => void;
  on: (type: SpinStopEvent, listener: (event: { originalEvent?: unknown }) => void) => void;
};

export type FrameScheduler = Pick<Window, "requestAnimationFrame" | "cancelAnimationFrame">;

type GlobeSpinOptions = {
  prefersReducedMotion: boolean;
  frames: FrameScheduler;
};

export function createGlobeSpin(
  map: SpinnableMap,
  { prefersReducedMotion, frames }: GlobeSpinOptions,
) {
  let spinFrameId: number | null = null;
  let lastFrameTime: number | null = null;
  let stopped = prefersReducedMotion;

  function spinFrame(now: number) {
    const elapsedSeconds =
      lastFrameTime === null ? 0 : Math.min((now - lastFrameTime) / 1000, MAX_SPIN_FRAME_SECONDS);

    lastFrameTime = now;
    spinFrameId = frames.requestAnimationFrame(spinFrame);

    if (elapsedSeconds > 0) {
      const center = map.getCenter();
      center.lng -= SPIN_DEGREES_PER_SECOND * elapsedSeconds;
      map.jumpTo({ center });
    }
  }

  function start() {
    if (stopped || spinFrameId !== null) return;

    spinFrameId = frames.requestAnimationFrame(spinFrame);
  }

  function stop() {
    if (stopped) return;
    stopped = true;

    if (spinFrameId !== null) {
      frames.cancelAnimationFrame(spinFrameId);
      spinFrameId = null;
    }
  }

  function stopOnUserInteraction() {
    map.on("click", stop);
    map.on("mousedown", stop);
    map.on("touchstart", stop);
    map.on("wheel", stop);
    map.on("zoomstart", stop);
    map.on("movestart", (event) => {
      if (!event.originalEvent) return;
      stop();
    });
  }

  return { start, stop, stopOnUserInteraction };
}
