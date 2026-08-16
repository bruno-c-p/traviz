import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { countryByName, countryRow, readMarks, resetAppStorage } from "./helpers";

test.describe("data import/export", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppStorage(page);
  });

  test("export then re-import leaves marks unchanged with zero rows skipped", async ({ page }) => {
    const portugal = countryByName("Portugal");
    const spain = countryByName("Spain");

    await page.goto("/list");
    await page.getByLabel("Search countries").fill("Portugal");
    await countryRow(page, "Portugal").getByRole("button", { name: "Visited", exact: true }).click();
    await page.getByLabel("Search countries").fill("Spain");
    await countryRow(page, "Spain").getByRole("button", { name: "Want to go", exact: true }).click();

    const originalMarks = await readMarks(page);
    expect(originalMarks).toEqual({ [portugal.code]: "visited", [spain.code]: "want" });

    await page.goto("/data");

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export marks" }).click();
    const download = await downloadPromise;
    const exportedPath = await download.path();
    if (!exportedPath) throw new Error("Download did not produce a local file path");
    const exportedContent = readFileSync(exportedPath, "utf-8");

    const exportedJson = JSON.parse(exportedContent);
    expect(exportedJson).toEqual({ version: 1, countries: originalMarks });

    await page
      .locator('input[type="file"]')
      .setInputFiles({ name: "roundtrip.json", mimeType: "application/json", buffer: Buffer.from(exportedContent) });

    await expect(page.getByText("Imported 2 marks.")).toBeVisible();
    await expect(page.getByText("No rows skipped.")).toBeVisible();

    const marksAfterImport = await readMarks(page);
    expect(marksAfterImport).toEqual(originalMarks);
  });

  test("importing corrupt JSON surfaces an error and leaves existing marks untouched", async ({ page }) => {
    const portugal = countryByName("Portugal");

    await page.goto("/list");
    await page.getByLabel("Search countries").fill("Portugal");
    await countryRow(page, "Portugal").getByRole("button", { name: "Visited", exact: true }).click();
    const marksBefore = await readMarks(page);

    await page.goto("/data");
    await page
      .locator('input[type="file"]')
      .setInputFiles({ name: "corrupt.json", mimeType: "application/json", buffer: Buffer.from("{not valid json") });

    await expect(page.getByText("File is not valid JSON")).toBeVisible();

    const marksAfter = await readMarks(page);
    expect(marksAfter).toEqual(marksBefore);
    expect(marksAfter).toEqual({ [portugal.code]: "visited" });
  });

  test("importing a bogus ISO code and an invalid state value skips only those rows", async ({ page }) => {
    const portugal = countryByName("Portugal");
    const france = countryByName("France");

    const payload = JSON.stringify({
      version: 1,
      countries: {
        [portugal.code]: "visited",
        ZZZ: "visited",
        [france.code]: "not_a_real_state",
      },
    });

    await page.goto("/data");
    await page
      .locator('input[type="file"]')
      .setInputFiles({ name: "partial.json", mimeType: "application/json", buffer: Buffer.from(payload) });

    await expect(page.getByText("Imported 1 mark.")).toBeVisible();
    await expect(page.getByText("Skipped 2 rows.")).toBeVisible();

    const unknownCodeRow = page.locator("li").filter({ hasText: "ZZZ" });
    await expect(unknownCodeRow).toContainText("Unknown country code");

    const invalidStateRow = page.locator("li").filter({ hasText: france.code });
    await expect(invalidStateRow).toContainText("Not a valid state value");

    const marks = await readMarks(page);
    expect(marks).toEqual({ [portugal.code]: "visited" });
  });

  test("reset all data requires confirmation and then clears every mark", async ({ page }) => {
    await page.goto("/list");
    await page.getByLabel("Search countries").fill("Portugal");
    await countryRow(page, "Portugal").getByRole("button", { name: "Visited", exact: true }).click();
    const marksBeforeReset = await readMarks(page);
    expect(Object.keys(marksBeforeReset)).toHaveLength(1);

    await page.goto("/data");
    await page.getByRole("button", { name: "Reset all data" }).click();
    await expect(page.getByText("Are you sure? All marks will be permanently deleted.")).toBeVisible();

    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText("Are you sure? All marks will be permanently deleted.")).toHaveCount(0);
    expect(await readMarks(page)).toEqual(marksBeforeReset);

    await page.getByRole("button", { name: "Reset all data" }).click();
    await page.getByRole("button", { name: "Yes, erase everything" }).click();
    await expect(page.getByText("All data has been reset.")).toBeVisible();

    expect(await readMarks(page)).toEqual({});
  });
});
