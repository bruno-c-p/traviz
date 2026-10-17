import { parseArgs } from "node:util";
import { join } from "node:path";
import type { Page } from "playwright-core";
import { z } from "zod";
import {
  launchBrowser,
  openPage,
  openRoute,
  settle,
  signIn,
  viewportHeight,
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

async function growToContent(page: Page, width: number): Promise<void> {
  const height = z
    .number()
    .parse(
      await page.evaluate(
        "Math.max(...Array.from(document.querySelectorAll('*'), (element) => element.scrollHeight))",
      ),
    );

  await page.setViewportSize({
    width,
    height: Math.min(Math.max(height, viewportHeight(width)), 4_000),
  });
  await settle(page);
}

function fileName(route: string, width: number): string {
  const name =
    route === homePath() ? "home" : route.replaceAll(/[^A-Za-z0-9]+/g, "-").replace(/^-/, "");

  return `${name}-${width}.png`;
}

try {
  for (const width of viewportWidths) {
    const driven = await openPage(browser, width, motion);

    await signIn(driven.page, baseUrl);

    for (const route of routes) {
      await openRoute(driven.page, baseUrl, route);
      await growToContent(driven.page, width);
      await driven.page.screenshot({ path: join(directory, fileName(route, width)) });
      await driven.page.setViewportSize({ width, height: viewportHeight(width) });
    }

    problems.push(...driven.problems);
    await driven.page.context().close();
  }
} catch (cause: unknown) {
  problems.push(cause instanceof Error ? cause.message : String(cause));
} finally {
  await browser.close();
}

console.log(`screenshots in ${directory}`);

console.log(problems.length === 0 ? "no console errors or failed requests" : problems.join("\n"));

if (problems.length > 0) process.exitCode = 1;
