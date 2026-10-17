import { parseArgs } from "node:util";
import type { Page } from "playwright-core";
import { z } from "zod";
import { COUNTRIES_BY_CODE, type Country } from "@/features/countries";
import { findMapExpression, openRoute, readCamera, settle } from "@/shared/testing/verify/browser";
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

const pointSchema = z.object({ x: z.number(), y: z.number() });

async function checkSpin(journal: Journal, page: Page): Promise<void> {
  await page.waitForTimeout(1_000);

  const before = await readCamera(page);

  await page.waitForTimeout(2_000);

  const after = await readCamera(page);
  const moved = before && after ? Math.abs(after.lng - before.lng) : 0;

  journal.record("the globe spins on its own", moved > 0.5, `lng moved ${moved.toFixed(2)} in 2 s`);
}

async function checkSearch(journal: Journal, page: Page, country: Country): Promise<void> {
  await page.getByRole("combobox", { name: "Find a country" }).fill(country.name);
  await settle(page);
  await page.getByRole("option").filter({ hasText: country.code }).first().click();
  await page.waitForTimeout(3_500);

  const camera = await readCamera(page);
  const [lng, lat] = country.center;

  const arrived =
    camera !== null && Math.abs(camera.lng - lng) < 1 && Math.abs(camera.lat - lat) < 1;

  journal.record(
    `search flies to ${country.name}`,
    arrived && camera?.moving === false,
    `camera ${JSON.stringify(camera)}, expected ${lng},${lat}`,
  );
  journal.record(
    "the country card opens for the picked country",
    await page.getByRole("group", { name: `Mark ${country.name}`, exact: true }).isVisible(),
    `group "Mark ${country.name}"`,
  );
  await journal.screenshot(page, "1-search-fly");
}

async function checkClick(journal: Journal, page: Page, country: Country): Promise<void> {
  await page.keyboard.press("Escape");
  await settle(page);

  const point = pointSchema.parse(
    await page.evaluate(`(() => {
      const map = ${findMapExpression};
      const center = ${JSON.stringify(country.center)};
      map.jumpTo({ center, zoom: 4 });
      const point = map.project(center);
      const box = map.getContainer().getBoundingClientRect();
      return { x: point.x + box.left, y: point.y + box.top };
    })()`),
  );

  await page.waitForTimeout(1_500);
  await page.mouse.click(point.x, point.y);
  await settle(page);
  journal.record(
    `a click on the globe selects ${country.name}`,
    await page.getByRole("group", { name: `Mark ${country.name}`, exact: true }).isVisible(),
    `clicked ${Math.round(point.x)},${Math.round(point.y)} after jumpTo`,
  );
  await journal.screenshot(page, "2-click");
}

async function checkZoom(journal: Journal, page: Page): Promise<void> {
  const before = (await readCamera(page))?.zoom ?? 0;

  await page.getByRole("button", { name: "Zoom in" }).click();
  await settle(page);

  const after = (await readCamera(page))?.zoom ?? 0;

  journal.record(
    "Zoom in raises the zoom by one",
    Math.abs(after - before - 1) < 0.01,
    `${before} to ${after}`,
  );
}

const searchedCountry = searched;
const clickedCountry = clicked;

await runJourney(
  `globe-search-${searched.code}`,
  "no-preference",
  async (journal, page, _browser, baseUrl) => {
    await openRoute(page, baseUrl, homePath());
    await checkSpin(journal, page);
    await checkSearch(journal, page, searchedCountry);
    await checkClick(journal, page, clickedCountry);
    await checkZoom(journal, page);
  },
);
