import { expect, test } from "@playwright/test";
import { countryByName, countryRow, listFilterBar, readMarks, resetAppStorage } from "./helpers";

test.describe("marking via the List", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppStorage(page, "/list");
  });

  test("searching and marking a country updates localStorage", async ({ page }) => {
    const portugal = countryByName("Portugal");

    await page.getByLabel("Search countries").fill("Portugal");
    const row = countryRow(page, "Portugal");
    await expect(row).toBeVisible();

    await row.getByRole("button", { name: "Visited", exact: true }).click();

    const marks = await readMarks(page);
    expect(marks).toEqual({ [portugal.code]: "visited" });
  });

  test("toggling the same state again removes the mark", async ({ page }) => {
    await page.getByLabel("Search countries").fill("Portugal");
    const row = countryRow(page, "Portugal");
    const visitedButton = row.getByRole("button", { name: "Visited", exact: true });

    await visitedButton.click();
    expect(await readMarks(page)).not.toEqual({});

    await visitedButton.click();
    const marks = await readMarks(page);
    expect(marks).toEqual({});
    expect(Object.keys(marks)).not.toContain(countryByName("Portugal").code);
  });

  test("a micro-state unclickable on the globe is markable here", async ({ page }) => {
    const monaco = countryByName("Monaco");

    await page.getByLabel("Search countries").fill("Monaco");
    const row = countryRow(page, "Monaco");
    await expect(row).toBeVisible();

    await row.getByRole("button", { name: "Visited", exact: true }).click();

    const marks = await readMarks(page);
    expect(marks).toEqual({ [monaco.code]: "visited" });
  });

  test("filter chips filter the list by state", async ({ page }) => {
    const portugal = countryByName("Portugal");
    const spain = countryByName("Spain");
    const andorra = countryByName("Andorra");

    const search = page.getByLabel("Search countries");

    await search.fill("Portugal");
    await countryRow(page, "Portugal").getByRole("button", { name: "Visited", exact: true }).click();

    await search.fill("Spain");
    await countryRow(page, "Spain").getByRole("button", { name: "Want to go", exact: true }).click();

    await search.fill("Andorra");
    await countryRow(page, "Andorra").getByRole("button", { name: "Not interested", exact: true }).click();

    await search.fill("");

    const marks = await readMarks(page);
    expect(marks).toEqual({
      [portugal.code]: "visited",
      [spain.code]: "want",
      [andorra.code]: "not_interested",
    });

    const filters = listFilterBar(page);

    await filters.getByRole("button", { name: "Visited", exact: true }).click();
    await expect(countryRow(page, "Portugal")).toBeVisible();
    await expect(countryRow(page, "Spain")).toHaveCount(0);
    await expect(countryRow(page, "Andorra")).toHaveCount(0);
    await expect(countryRow(page, "Germany")).toHaveCount(0);
    await filters.getByRole("button", { name: "Visited", exact: true }).click();

    await filters.getByRole("button", { name: "Want", exact: true }).click();
    await expect(countryRow(page, "Spain")).toBeVisible();
    await expect(countryRow(page, "Portugal")).toHaveCount(0);
    await expect(countryRow(page, "Andorra")).toHaveCount(0);
    await filters.getByRole("button", { name: "Want", exact: true }).click();

    await filters.getByRole("button", { name: "Not interested", exact: true }).click();
    await expect(countryRow(page, "Andorra")).toBeVisible();
    await expect(countryRow(page, "Portugal")).toHaveCount(0);
    await expect(countryRow(page, "Spain")).toHaveCount(0);
    await filters.getByRole("button", { name: "Not interested", exact: true }).click();

    await filters.getByRole("button", { name: "Unmarked", exact: true }).click();
    await expect(countryRow(page, "Germany")).toBeVisible();
    await expect(countryRow(page, "Portugal")).toHaveCount(0);
    await expect(countryRow(page, "Spain")).toHaveCount(0);
    await expect(countryRow(page, "Andorra")).toHaveCount(0);
  });
});
