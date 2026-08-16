import { expect, test } from "@playwright/test";
import { findLandPixel, readMarks, resetAppStorage, waitForMapReady } from "./helpers";

// KNOWN BLOCKER: the globe's auto-rotate keeps Mapbox in a permanent
// isMoving() === true state, and Mapbox suppresses click events while
// moving. Every test in this file is expected to fail (timeout waiting for
// the mark popover) until that is fixed elsewhere. Written country-agnostic
// on purpose: the globe spins, so a fixed pixel maps to a different country
// on every run — never assert which one.

test.describe("globe click-to-mark", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppStorage(page);
    await waitForMapReady(page);
  });

  test("clicking a country opens the mark popover, marking it persists across reload", async ({ page }) => {
    const point = await findLandPixel(page);
    await page.mouse.click(point.x, point.y);

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await expect(dialog.getByRole("button", { name: "Visited", exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Want to go", exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Not interested", exact: true })).toBeVisible();

    await dialog.getByRole("button", { name: "Visited", exact: true }).click();

    const marksAfterMark = await readMarks(page);
    const entries = Object.entries(marksAfterMark);
    expect(entries).toHaveLength(1);
    const [, state] = entries[0];
    expect(state).toBe("visited");

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    await page.reload();
    const marksAfterReload = await readMarks(page);
    expect(marksAfterReload).toEqual(marksAfterMark);
  });
});
