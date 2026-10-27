const SPIN_DEGREES_PER_SECOND = 1.5;
const MAX_SPIN_FRAME_SECONDS = 0.1;

export type SpinnableMap = {
  getCenter: () => { lng: number; lat: number };
  jumpTo: (options: { center: [number, number] }) => void;
  onUserInteraction: (listener: () => void) => void;
};

export type FrameScheduler = Pick<Window, "requestAnimationFrame" | "cancelAnimationFrame">;

type GlobeSpinOptions = {
  startsStopped: boolean;
  frames: FrameScheduler;
};

export function createGlobeSpin(map: SpinnableMap, { startsStopped, frames }: GlobeSpinOptions) {
  let spinFrameId: number | null = null;
  let lastFrameTime: number | null = null;
  let stopped = startsStopped;

  function spinFrame(now: number) {
    const elapsedSeconds =
      lastFrameTime === null ? 0 : Math.min((now - lastFrameTime) / 1000, MAX_SPIN_FRAME_SECONDS);

    lastFrameTime = now;
    spinFrameId = frames.requestAnimationFrame(spinFrame);

    if (elapsedSeconds > 0) {
      const { lng, lat } = map.getCenter();

      map.jumpTo({ center: [lng - SPIN_DEGREES_PER_SECOND * elapsedSeconds, lat] });
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
    map.onUserInteraction(stop);
  }

  return { start, stop, stopOnUserInteraction, isStopped: () => stopped };
}
