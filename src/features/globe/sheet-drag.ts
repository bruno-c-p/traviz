const DRAG_START_DISTANCE = 4;
const DISMISS_DISTANCE_RATIO = 0.25;
const DISMISS_VELOCITY = 0.11;
const UPWARD_DRAG_FRICTION = 2;

export function isDragStart(distance: number): boolean {
  return Math.abs(distance) >= DRAG_START_DISTANCE;
}

export function dragOffset(distance: number): number {
  return distance >= 0 ? distance : -Math.sqrt(-distance) * UPWARD_DRAG_FRICTION;
}

export function isDismissingDrag(offset: number, sheetHeight: number, elapsedMs: number): boolean {
  return offset > sheetHeight * DISMISS_DISTANCE_RATIO || offset / elapsedMs > DISMISS_VELOCITY;
}
