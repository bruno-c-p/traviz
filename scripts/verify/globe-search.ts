import { parseArgs } from "node:util";
import type { Page } from "playwright-core";
import { COUNTRIES_BY_CODE, type Country } from "@/features/countries";
import {
  globeCanvasSelector,
  hasGlobe,
  openRoute,
  readGlobeSignature,
  settle,
} from "@/shared/testing/verify/browser";
import { runJourney, type Journal } from "@/shared/testing/verify/journal";
import { homePath } from "@/paths";

const { values: options } = parseArgs({
  options: {
    code: { type: "string", default: "JPN" },
    click: { type: "string", default: "FRA" },
  },
});

const searched = COUNTRIES_BY_CODE.get(options.code.toUpperCase());
const clicked = COUNTRIES_BY_CODE.get(options.click.toUpperCase());

if (!searched || !clicked) {
  console.error(`Unknown country code: ${searched ? options.click : options.code}.`);
  process.exit(1);
}

function cardOf(page: Page, country: Country) {
  return page.getByRole("group", { name: `Mark ${country.name}`, exact: true });
}

async function isStill(page: Page): Promise<boolean> {
  const before = await readGlobeSignature(page);

  await page.waitForTimeout(600);

  return before !== null && before.signature === (await readGlobeSignature(page))?.signature;
}

async function checkSpin(journal: Journal, page: Page): Promise<void> {
  await page.waitForTimeout(1_000);

  const before = await readGlobeSignature(page);

  await page.waitForTimeout(2_000);

  const after = await readGlobeSignature(page);

  journal.record(
    "the globe spins on its own",
    before !== null && after !== null && before.signature !== after.signature,
    before === null || after === null
      ? "the globe canvas could not be read"
      : `the canvas ${before.signature === after.signature ? "did not change" : "changed"} in 2 s`,
  );
}

async function flyTo(page: Page, country: Country): Promise<void> {
  await page.getByRole("combobox", { name: "Find a country" }).fill(country.name);
  await settle(page);
  await page.locator(`[role="option"][id$="-${country.code}"]`).click();
  await page.waitForTimeout(3_500);
}

async function checkSearch(journal: Journal, page: Page, country: Country): Promise<void> {
  const before = await readGlobeSignature(page);

  await flyTo(page, country);

  const after = await readGlobeSignature(page);

  journal.record(
    `search moves the globe for ${country.name} and it comes to rest`,
    before?.signature !== after?.signature && (await isStill(page)),
    "compared the canvas before the search, after the fly and 600 ms later",
  );
  journal.record(
    "the country card opens for the picked country",
    await cardOf(page, country).isVisible(),
    `group "Mark ${country.name}"`,
  );
  await journal.screenshot(page, "1-search-fly");
}

async function checkClick(journal: Journal, page: Page, country: Country): Promise<void> {
  await flyTo(page, country);
  await page.keyboard.press("Escape");
  await settle(page);

  const isClosed = !(await cardOf(page, country).isVisible());
  const box = await page.locator(globeCanvasSelector).boundingBox();

  if (box === null) {
    journal.record(`a click on the globe selects ${country.name}`, false, "no globe canvas");

    return;
  }

  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

  await page.mouse.click(point.x, point.y);
  await settle(page);
  journal.record(
    `a click on the globe selects ${country.name}`,
    isClosed && (await cardOf(page, country).isVisible()),
    `Escape ${isClosed ? "closed" : "did not close"} the card, then clicked the canvas centre ${Math.round(point.x)},${Math.round(point.y)} after the fly`,
  );
  await journal.screenshot(page, "2-click");
}

async function checkZoom(journal: Journal, page: Page): Promise<void> {
  const before = await readGlobeSignature(page);

  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.waitForTimeout(1_200);

  const after = await readGlobeSignature(page);

  journal.record(
    "Zoom in draws the globe larger",
    before !== null &&
      after !== null &&
      after.opaque >= before.opaque &&
      after.signature !== before.signature,
    `drawn sample points ${before?.opaque ?? "none"} to ${after?.opaque ?? "none"} of 2304`,
  );
  await journal.screenshot(page, "3-zoom");
}

const searchedCountry = searched;
const clickedCountry = clicked;

await runJourney(
  `globe-search-${searched.code}`,
  "no-preference",
  async (journal, page, _browser, baseUrl) => {
    await openRoute(page, baseUrl, homePath());

    if (!(await hasGlobe(page))) {
      journal.record(
        "the globe is on the page",
        false,
        `no ${globeCanvasSelector}. This tree still renders the globe placeholder.`,
      );

      return;
    }

    await checkSpin(journal, page);
    await checkSearch(journal, page, searchedCountry);
    await checkClick(journal, page, clickedCountry);
    await checkZoom(journal, page);
  },
);
