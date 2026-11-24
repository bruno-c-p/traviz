import { describe, expect, test } from "bun:test";
import { dragOffset, isDismissingDrag, isDragStart } from "@/features/globe/sheet-drag";

describe("country sheet drag", () => {
  test("a drag starts after 4 px in either direction, so a tap stays a tap", () => {
    expect(isDragStart(3)).toBe(false);
    expect(isDragStart(-3)).toBe(false);
    expect(isDragStart(4)).toBe(true);
    expect(isDragStart(-4)).toBe(true);
  });

  test("the sheet follows the finger down and resists being pulled up", () => {
    expect(dragOffset(120)).toBe(120);
    expect(dragOffset(-100)).toBe(-20);
  });

  test("a drag past a quarter of the sheet dismisses it, however slow", () => {
    expect(isDismissingDrag(101, 400, 5000)).toBe(true);
    expect(isDismissingDrag(100, 400, 5000)).toBe(false);
  });

  test("a quick flick down dismisses it over a short distance", () => {
    expect(isDismissingDrag(30, 400, 200)).toBe(true);
    expect(isDismissingDrag(30, 400, 400)).toBe(false);
  });

  test("an upward drag never dismisses it", () => {
    expect(isDismissingDrag(dragOffset(-300), 400, 50)).toBe(false);
  });
});
