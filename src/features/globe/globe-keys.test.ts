import { describe, expect, test } from "bun:test";
import { panCamera } from "@/features/globe/globe-camera";
import type { Camera } from "@/features/globe/globe-camera";
import { keyAction } from "@/features/globe/globe-keys";

const CAMERA: Camera = { center: [10, 20], zoom: 2 };

function press(
  key: string,
  modifiers: Partial<{ altKey: boolean; ctrlKey: boolean; metaKey: boolean }> = {},
) {
  return keyAction({ key, altKey: false, ctrlKey: false, metaKey: false, ...modifiers });
}

function cameraAfter(key: string): Camera {
  const action = press(key);

  if (action?.kind !== "pan") throw new Error(`${key} does not pan`);

  return panCamera(CAMERA, action.dx, action.dy);
}

describe("keyAction", () => {
  test("the arrow keys move the view toward the side they point at", () => {
    expect(cameraAfter("ArrowLeft").center[0]).toBeLessThan(CAMERA.center[0]);
    expect(cameraAfter("ArrowRight").center[0]).toBeGreaterThan(CAMERA.center[0]);
    expect(cameraAfter("ArrowUp").center[1]).toBeGreaterThan(CAMERA.center[1]);
    expect(cameraAfter("ArrowDown").center[1]).toBeLessThan(CAMERA.center[1]);
    expect(cameraAfter("ArrowLeft").center[1]).toBe(CAMERA.center[1]);
    expect(cameraAfter("ArrowUp").center[0]).toBe(CAMERA.center[0]);
  });

  test("an arrow pans by 100 px, as the Mapbox keyboard handler did", () => {
    const [longitude] = cameraAfter("ArrowRight").center;

    expect(panCamera(CAMERA, -100, 0).center[0]).toBe(longitude);
  });

  test("plus and equals zoom in by one level, and minus zooms out by one", () => {
    expect(press("+")).toEqual({ kind: "zoom", zoomDelta: 1 });
    expect(press("=")).toEqual({ kind: "zoom", zoomDelta: 1 });
    expect(press("-")).toEqual({ kind: "zoom", zoomDelta: -1 });
  });

  test("leaves other keys and browser shortcuts alone", () => {
    expect(press("a")).toBeNull();
    expect(press("Tab")).toBeNull();
    expect(press("Enter")).toBeNull();
    expect(press("toString")).toBeNull();
    expect(press("-", { metaKey: true })).toBeNull();
    expect(press("=", { ctrlKey: true })).toBeNull();
    expect(press("ArrowLeft", { altKey: true })).toBeNull();
  });
});
