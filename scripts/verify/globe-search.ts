import { join } from "node:path";
import { parseArgs } from "node:util";
import { z } from "zod";
import {
  findMapExpression,
  launchBrowser,
  openPage,
  readCamera,
  settle,
  signIn,
} from "@/shared/testing/verify/browser";
import { evidenceDirectory, requireBaseUrl } from "@/shared/testing/verify/instance";
import { Journal } from "@/shared/testing/verify/journal";
import { homePath } from "@/paths";

const { values: options } = parseArgs({
  options: {
    name: { type: "string", default: "Japan" },
    lng: { type: "string", default: "138" },
    lat: { type: "string", default: "36" },
    click: { type: "string", default: "France" },
    "click-lng": { type: "string", default: "2.35" },
    "click-lat": { type: "string", default: "46.6" },
  },
});

const baseUrl = requireBaseUrl();
const directory = evidenceDirectory(`globe-search-${options.name}`);
const journal = new Journal();
const pointSchema = z.object({ x: z.number(), y: z.number() });

const browser = await launchBrowser();
const { page, problems } = await openPage(browser, 1440, "no-preference");

await signIn(page, baseUrl);

await page.goto(baseUrl + homePath(), { waitUntil: "networkidle" });

await page.waitForFunction(`${findMapExpression}?.isStyleLoaded() === true`, null, {
  timeout: 30_000,
});

const beforeSpin = await readCamera(page);

await page.waitForTimeout(2_000);

const afterSpin = await readCamera(page);

journal.record(
  "the globe spins on its own",
  beforeSpin !== null && afterSpin !== null && afterSpin.lng !== beforeSpin.lng,
  `lng ${beforeSpin?.lng.toFixed(2)} then ${afterSpin?.lng.toFixed(2)}`,
);

await page.getByRole("combobox", { name: "Find a country" }).fill(options.name);

await settle(page);

await page
  .getByRole("option", { name: new RegExp(options.name) })
  .first()
  .click();

await page.waitForTimeout(3_500);

const flown = await readCamera(page);

journal.record(
  `search flies to ${options.name}`,
  flown !== null &&
    Math.abs(flown.lng - Number(options.lng)) < 1 &&
    Math.abs(flown.lat - Number(options.lat)) < 1 &&
    !flown.moving,
  JSON.stringify(flown),
);

journal.record(
  "the country card opens for the picked country",
  (await page.getByRole("group", { name: `Mark ${options.name}` }).count()) > 0,
  `group "Mark ${options.name}"`,
);

await page.screenshot({ path: join(directory, "1-search-fly.png") });

await page.keyboard.press("Escape");

await settle(page);

const clickPoint = pointSchema.parse(
  await page.evaluate(`(() => {
    const map = ${findMapExpression};
    const center = [${Number(options["click-lng"])}, ${Number(options["click-lat"])}];
    map.jumpTo({ center, zoom: 4 });
    const point = map.project(center);
    const box = map.getContainer().getBoundingClientRect();
    return { x: point.x + box.left, y: point.y + box.top };
  })()`),
);

await page.waitForTimeout(1_500);

await page.mouse.click(clickPoint.x, clickPoint.y);

await settle(page);

journal.record(
  `a click on the globe selects ${options.click}`,
  (await page.getByRole("group", { name: `Mark ${options.click}` }).count()) > 0,
  `clicked ${Math.round(clickPoint.x)},${Math.round(clickPoint.y)}`,
);

await page.screenshot({ path: join(directory, "2-click.png") });

const zoomBefore = (await readCamera(page))?.zoom ?? 0;

await page.getByRole("button", { name: "Zoom in" }).click();

await settle(page);

const zoomAfter = (await readCamera(page))?.zoom ?? 0;

journal.record(
  "Zoom in raises the zoom by one",
  Math.abs(zoomAfter - zoomBefore - 1) < 0.01,
  `${zoomBefore} to ${zoomAfter}`,
);

await browser.close();

journal.finish(directory, problems);
