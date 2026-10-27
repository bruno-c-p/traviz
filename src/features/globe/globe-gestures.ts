export type Point = { x: number; y: number };

export type GestureHandlers = {
  begin: () => void;
  pan: (dx: number, dy: number) => void;
  zoomAround: (point: Point, zoomDelta: number) => void;
  release: (velocity: Point) => void;
  tap: (point: Point) => void;
  doubleTap: (point: Point) => void;
};

type Sample = { point: Point; time: number };

type Gesture = { start: Point; moved: boolean; pinched: boolean; samples: Sample[] };

const TAP_SLOP = 4;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_SLOP = 24;
const VELOCITY_WINDOW_MS = 100;
const WHEEL_PIXELS_PER_ZOOM = 450;
const MAX_WHEEL_ZOOM = 0.5;

function distance(first: Point, second: Point): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function midpoint(first: Point, second: Point): Point {
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
}

function releaseVelocity(samples: Sample[], time: number): Point {
  const recent = samples.filter((sample) => time - sample.time <= VELOCITY_WINDOW_MS);
  const first = recent.at(0);
  const last = recent.at(-1);

  if (!first || !last || last.time === first.time) return { x: 0, y: 0 };

  const seconds = (last.time - first.time) / 1000;

  return {
    x: (last.point.x - first.point.x) / seconds,
    y: (last.point.y - first.point.y) / seconds,
  };
}

export function createGestureTracker(handlers: GestureHandlers) {
  const pointers = new Map<number, Point>();
  let gesture: Gesture | null = null;
  let lastTap: Sample | null = null;

  function pinch(active: Gesture, previous: Point, point: Point, other: Point) {
    const before = midpoint(previous, other);
    const after = midpoint(point, other);

    active.moved = true;
    handlers.pan(after.x - before.x, after.y - before.y);
    handlers.zoomAround(after, Math.log2(distance(point, other) / distance(previous, other)));
  }

  function drag(active: Gesture, previous: Point, point: Point, time: number) {
    if (!active.moved && distance(active.start, point) < TAP_SLOP) return;

    active.moved = true;
    active.samples.push({ point, time });
    handlers.pan(point.x - previous.x, point.y - previous.y);
  }

  function endWithTap(point: Point, time: number) {
    const isDoubleTap =
      lastTap !== null &&
      time - lastTap.time < DOUBLE_TAP_MS &&
      distance(lastTap.point, point) < DOUBLE_TAP_SLOP;

    handlers.tap(point);

    if (isDoubleTap) {
      lastTap = null;
      handlers.doubleTap(point);
    } else {
      lastTap = { point, time };
    }
  }

  return {
    down(pointerId: number, point: Point, time: number) {
      pointers.set(pointerId, point);
      handlers.begin();

      if (gesture && pointers.size > 1) {
        gesture.pinched = true;
        gesture.samples = [];
      } else {
        gesture = { start: point, moved: false, pinched: false, samples: [{ point, time }] };
      }
    },

    move(pointerId: number, point: Point, time: number): boolean {
      const previous = pointers.get(pointerId);

      if (!previous || !gesture) return false;

      const other = [...pointers].find(([id]) => id !== pointerId)?.[1];

      if (other) pinch(gesture, previous, point, other);
      else drag(gesture, previous, point, time);

      pointers.set(pointerId, point);

      return true;
    },

    up(pointerId: number, point: Point, time: number, isCancelled: boolean) {
      if (!pointers.delete(pointerId) || !gesture) return;

      if (pointers.size > 0) {
        gesture.samples = [];

        return;
      }

      const ended = gesture;

      gesture = null;

      if (ended.moved || ended.pinched || isCancelled) {
        handlers.release(releaseVelocity(ended.samples, time));
      } else {
        endWithTap(point, time);
      }
    },

    wheel(point: Point, deltaPixels: number) {
      const zoomDelta = Math.min(
        Math.max(-deltaPixels / WHEEL_PIXELS_PER_ZOOM, -MAX_WHEEL_ZOOM),
        MAX_WHEEL_ZOOM,
      );

      handlers.begin();
      handlers.zoomAround(point, zoomDelta);
    },

    isDragging: () => gesture?.moved === true,
  };
}
