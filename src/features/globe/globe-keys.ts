export type KeyAction =
  | { kind: "pan"; dx: number; dy: number }
  | { kind: "zoom"; zoomDelta: number };

type KeyPress = { key: string; altKey: boolean; ctrlKey: boolean; metaKey: boolean };

const PAN_STEP_PIXELS = 100;

const KEY_ACTIONS = new Map<string, KeyAction>([
  ["ArrowLeft", { kind: "pan", dx: PAN_STEP_PIXELS, dy: 0 }],
  ["ArrowRight", { kind: "pan", dx: -PAN_STEP_PIXELS, dy: 0 }],
  ["ArrowUp", { kind: "pan", dx: 0, dy: PAN_STEP_PIXELS }],
  ["ArrowDown", { kind: "pan", dx: 0, dy: -PAN_STEP_PIXELS }],
  ["+", { kind: "zoom", zoomDelta: 1 }],
  ["=", { kind: "zoom", zoomDelta: 1 }],
  ["-", { kind: "zoom", zoomDelta: -1 }],
]);

export function keyAction({ key, altKey, ctrlKey, metaKey }: KeyPress): KeyAction | null {
  if (altKey || ctrlKey || metaKey) return null;

  return KEY_ACTIONS.get(key) ?? null;
}
