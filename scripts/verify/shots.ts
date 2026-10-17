import { parseArgs } from "node:util";
import { join } from "node:path";
import {
  launchBrowser,
  openPage,
  settle,
  signIn,
  viewportWidths,
} from "@/shared/testing/verify/browser";
import { evidenceDirectory, requireBaseUrl } from "@/shared/testing/verify/instance";
import { homePath, listPath, statsPath } from "@/paths";

const { values: options } = parseArgs({
  options: {
    label: { type: "string", default: "shots" },
    route: { type: "string", multiple: true },
    motion: { type: "string", default: "reduce" },
  },
});

const baseUrl = requireBaseUrl();
const routes = options.route ?? [homePath(), listPath(), statsPath()];
const motion = options.motion === "no-preference" ? "no-preference" : "reduce";
const directory = evidenceDirectory(options.label);
const browser = await launchBrowser();
const problems: string[] = [];

for (const width of viewportWidths) {
  const driven = await openPage(browser, width, motion);

  await signIn(driven.page, baseUrl);

  for (const route of routes) {
    await driven.page.goto(baseUrl + route, { waitUntil: "networkidle" });
    await settle(driven.page);

    const name = route === "/" ? "home" : route.replaceAll("/", "-").replace(/^-/, "");

    await driven.page.screenshot({ path: join(directory, `${name}-${width}.png`), fullPage: true });
  }

  problems.push(...driven.problems);
  await driven.page.context().close();
}

await browser.close();

console.log(`screenshots in ${directory}`);

console.log(problems.length === 0 ? "no console errors or failed requests" : problems.join("\n"));
