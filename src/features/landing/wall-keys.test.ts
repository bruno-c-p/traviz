import { describe, expect, test } from "bun:test";
import { nextWallIndex } from "@/features/landing/wall-keys";
import type { Box } from "@/features/landing/wall-keys";

const box = (left: number, top: number, width: number): Box => ({ left, top, width, height: 40 });

const rows: Box[] = [
  box(0, 0, 100),
  box(110, 0, 200),
  box(320, 0, 80),
  box(0, 48, 260),
  box(270, 48, 120),
];

describe("nextWallIndex", () => {
  test("left and right step through the names and stop at either end", () => {
    expect(nextWallIndex("ArrowRight", 1, rows)).toBe(2);
    expect(nextWallIndex("ArrowLeft", 1, rows)).toBe(0);
    expect(nextWallIndex("ArrowLeft", 0, rows)).toBe(0);
    expect(nextWallIndex("ArrowRight", 4, rows)).toBe(4);
  });

  test("Home and End jump to the first and last name", () => {
    expect(nextWallIndex("Home", 3, rows)).toBe(0);
    expect(nextWallIndex("End", 0, rows)).toBe(4);
  });

  test("down and up move to the name on the next line nearest the current one's centre", () => {
    expect(nextWallIndex("ArrowDown", 2, rows)).toBe(4);
    expect(nextWallIndex("ArrowDown", 0, rows)).toBe(3);
    expect(nextWallIndex("ArrowUp", 4, rows)).toBe(2);
  });

  test("down on the last line and up on the first line do nothing, so the page can scroll", () => {
    expect(nextWallIndex("ArrowDown", 3, rows)).toBeNull();
    expect(nextWallIndex("ArrowUp", 1, rows)).toBeNull();
  });

  test("other keys are left to the browser", () => {
    expect(nextWallIndex("Enter", 1, rows)).toBeNull();
  });
});
