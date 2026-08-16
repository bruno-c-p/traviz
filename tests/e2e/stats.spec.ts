import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { COUNTRIES, countryByName, countryRow, resetAppStorage } from "./helpers";

const HEADLINE_TOTAL = COUNTRIES.filter((c) => c.counted).length;

function headline(page: Page) {
  return page.locator("div.text-5xl.font-bold.tabular-nums");
}

function totalsCard(page: Page, index: number) {
  return page.locator('h2:has-text("Totals (incl. territories)") + div > div').nth(index);
}

test.describe("stats — the 195 denominator", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppStorage(page);
  });

  test("marking a normal country increments the headline visited count", async ({ page }) => {
    await page.goto("/list");
    await page.getByLabel("Search countries").fill("Germany");
    await countryRow(page, "Germany").getByRole("button", { name: "Visited", exact: true }).click();

    await page.goto("/stats");
    const text = await headline(page).innerText();
    const match = text.match(/(\d+)\s*\/\s*(\d+)/);
    expect(match).not.toBeNull();
    expect(match?.[1]).toBe("1");
    expect(match?.[2]).toBe(String(HEADLINE_TOTAL));
    expect(HEADLINE_TOTAL).toBe(195);
  });

  test("marking a territory does not move the headline but does move totals", async ({ page }) => {
    const puertoRico = countryByName("Puerto Rico");
    expect(puertoRico.counted).toBe(false);

    await page.goto("/list");
    await page.getByLabel("Search countries").fill("Puerto Rico");
    await countryRow(page, "Puerto Rico").getByRole("button", { name: "Visited", exact: true }).click();

    await page.goto("/stats");
    const text = await headline(page).innerText();
    const match = text.match(/(\d+)\s*\/\s*(\d+)/);
    expect(match?.[1]).toBe("0");
    expect(match?.[2]).toBe(String(HEADLINE_TOTAL));

    const visitedTotalCard = totalsCard(page, 0);
    const visitedTotalCount = await visitedTotalCard.locator(".text-2xl").innerText();
    expect(visitedTotalCount).toBe("1");
  });
});
