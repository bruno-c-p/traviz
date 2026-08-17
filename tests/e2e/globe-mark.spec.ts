import { expect, test } from "@playwright/test";
import { findLandPixel, readMarks, resetAppStorage, stopGlobeSpin, waitForMapReady } from "./helpers";

// Written country-agnostic on purpose: the globe spins until first interaction,
// so which country sits under a given pixel differs from run to run — never
// assert which one. `stopGlobeSpin` parks the camera first so that locating a
// land pixel and clicking it are not racing the rotation.

test.describe("globe click-to-mark", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppStorage(page);
    await waitForMapReady(page);
    await stopGlobeSpin(page);
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
