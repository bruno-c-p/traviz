import { execFileSync } from "node:child_process";
import { chromium, type Browser, type Page } from "playwright-core";
import { z } from "zod";
import { createSignInToken, findSeededUserId } from "@/shared/testing/clerk-dev";
import { databasePath } from "@/shared/testing/verify/instance";
import { homePath, signInPath } from "@/paths";

export const viewportWidths = [375, 768, 1440] as const;

const settleMs = 700;

export function viewportHeight(width: number): number {
  return width < 768 ? 812 : 900;
}

export type Motion = "reduce" | "no-preference";

export type DrivenPage = { page: Page; problems: string[] };

export function launchBrowser(): Promise<Browser> {
  return chromium.launch({ channel: "chrome" });
}

export async function openPage(
  browser: Browser,
  width: number,
  motion: Motion,
): Promise<DrivenPage> {
  const context = await browser.newContext({
    viewport: { width, height: viewportHeight(width) },
    reducedMotion: motion,
  });

  const page = await context.newPage();
  const problems: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`console error: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`page error: ${error.message}`));
  page.on("response", (response) => {
    if (response.status() >= 400) problems.push(`http ${response.status()}: ${response.url()}`);
  });

  return { page, problems };
}

export async function signIn(page: Page, baseUrl: string): Promise<void> {
  const userId = findSeededUserId();

  if (!userId) throw new Error("The dev test user does not exist. Run bun run setup first.");

  const ticket = createSignInToken(userId);

  await page.goto(baseUrl + signInPath());
  await page.waitForFunction("window.Clerk?.loaded === true", null, { timeout: 30_000 });
  await page.evaluate(`(async () => {
    const attempt = await window.Clerk.client.signIn.create({ strategy: "ticket", ticket: ${JSON.stringify(ticket)} });
    await window.Clerk.setActive({ session: attempt.createdSessionId });
  })()`);
  await page.waitForFunction("Boolean(window.Clerk?.session?.id)", null, { timeout: 10_000 });
}

export async function openRoute(page: Page, baseUrl: string, route: string): Promise<void> {
  await page.goto(baseUrl + route, { waitUntil: "networkidle" });

  const landed = new URL(page.url()).pathname;
  const expected = new URL(route, baseUrl).pathname;

  if (landed !== expected) throw new Error(`Opened ${route} but landed on ${landed}.`);

  if (expected === homePath())
    await page.waitForFunction(`${findMapExpression}?.isLoaded() === true`, null, {
      timeout: 30_000,
    });

  await settle(page);
}

export function settle(page: Page): Promise<void> {
  return page.waitForTimeout(settleMs);
}

const cameraSchema = z
  .object({
    lng: z.number(),
    lat: z.number(),
    zoom: z.number(),
    moving: z.boolean(),
    loaded: z.boolean(),
  })
  .nullable();

export type Camera = z.infer<typeof cameraSchema>;

export const findMapExpression = `(() => {
  const element = document.querySelector("[data-globe]");
  if (!element) return null;
  const fiberKey = Object.keys(element).find((key) => key.startsWith("__reactFiber$"));
  for (let fiber = element[fiberKey]; fiber; fiber = fiber.return)
    for (let hook = fiber.memoizedState; hook; hook = hook.next) {
      const ref = hook.memoizedState;
      if (ref && typeof ref === "object" && ref.current && typeof ref.current.getCenter === "function") return ref.current;
    }
  return null;
})()`;

export async function readCamera(page: Page): Promise<Camera> {
  const camera: unknown = await page.evaluate(`(() => {
    const map = ${findMapExpression};
    if (!map) return null;
    const center = map.getCenter();
    return { lng: center.lng, lat: center.lat, zoom: map.getZoom(), moving: map.isMoving(), loaded: map.isLoaded() };
  })()`);

  return cameraSchema.parse(camera);
}

const markRowsSchema = z.array(
  z.object({ user_id: z.string(), code: z.string(), state: z.string() }),
);

export type MarkRow = z.infer<typeof markRowsSchema>[number];

export function markTableExists(): boolean {
  return (
    execFileSync(
      "sqlite3",
      [
        "-readonly",
        databasePath(),
        "select count(*) from sqlite_master where type = 'table' and name = 'marks'",
      ],
      { encoding: "utf8" },
    ).trim() === "1"
  );
}

export function readMarkRows(): MarkRow[] {
  const output = execFileSync(
    "sqlite3",
    ["-json", "-readonly", databasePath(), "select user_id, code, state from marks order by code"],
    { encoding: "utf8" },
  ).trim();

  return markRowsSchema.parse(output === "" ? [] : JSON.parse(output));
}
