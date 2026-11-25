import { Database } from "bun:sqlite";
import { chromium, type Browser, type Page } from "playwright-core";
import { z } from "zod";
import { ticketSignInExpression } from "@/shared/testing/clerk-browser";
import { createSignInToken, findSeededUserId } from "@/shared/testing/clerk-dev";
import { readPerfEnvironment } from "@/shared/testing/perf/environment";
import { databasePath, repoRoot, requireInstance } from "@/shared/testing/verify/instance";
import { homePath, listPath, signInPath } from "@/paths";

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

function clerkPublishableKey(): string {
  const perfEnvironment = readPerfEnvironment(repoRoot, process.env);

  if (perfEnvironment.kind === "refused") throw new Error(perfEnvironment.reason);

  return perfEnvironment.environment.PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
}

export async function signIn(page: Page, baseUrl: string): Promise<void> {
  if (requireInstance().signIn === "fixed-user") return;

  const userId = await Promise.resolve(findSeededUserId());

  if (!userId) throw new Error("The dev test user does not exist. Run bun run setup first.");

  const ticket = await Promise.resolve(createSignInToken(userId));

  await page.goto(baseUrl + signInPath());
  await page
    .evaluate(ticketSignInExpression(ticket, clerkPublishableKey()))
    .catch((cause: unknown) => {
      if (!(cause instanceof Error && /context was destroyed|navigation/i.test(cause.message)))
        throw cause;
    });
  await page.goto(baseUrl + listPath());

  if (new URL(page.url()).pathname !== listPath())
    throw new Error(`The ticket sign-in did not reach ${listPath()}: landed on ${page.url()}.`);
}

export async function openRoute(page: Page, baseUrl: string, route: string): Promise<void> {
  await page.goto(baseUrl + route, { waitUntil: "networkidle" });

  const landed = new URL(page.url()).pathname;
  const expected = new URL(route, baseUrl).pathname;

  if (landed !== expected) throw new Error(`Opened ${route} but landed on ${landed}.`);

  if (expected === homePath())
    await page.waitForFunction(globeDrawnExpression, null, { timeout: 30_000 });

  await settle(page);
}

export function settle(page: Page): Promise<void> {
  return page.waitForTimeout(settleMs);
}

export const globeCanvasSelector = "[data-globe-host] canvas";

const globePlaceholderSelector = "[data-globe-host][data-placeholder]";

const globeDrawnExpression = `(() => {
  if (document.querySelector(${JSON.stringify(globePlaceholderSelector)})) return true;
  const canvas = document.querySelector(${JSON.stringify(globeCanvasSelector)});
  if (!canvas || canvas.width === 0) return false;
  const pixel = canvas.getContext("2d")?.getImageData(canvas.width >> 1, canvas.height >> 1, 1, 1).data;
  return Boolean(pixel) && pixel[3] > 0;
})()`;

const globeSignatureExpression = `(() => {
  const canvas = document.querySelector(${JSON.stringify(globeCanvasSelector)});
  const context = canvas?.getContext("2d");
  if (!canvas || !context || canvas.width === 0) return null;
  const columns = 48;
  const rows = 48;
  let signature = "";
  let opaque = 0;
  for (let row = 0; row < rows; row++)
    for (let column = 0; column < columns; column++) {
      const x = Math.floor(((column + 0.5) * canvas.width) / columns);
      const y = Math.floor(((row + 0.5) * canvas.height) / rows);
      const [red, green, blue, alpha] = context.getImageData(x, y, 1, 1).data;
      if (alpha > 0) opaque += 1;
      signature += ((red >> 4) << 8 | (green >> 4) << 4 | (blue >> 4)).toString(36) + (alpha > 0 ? "" : "!") + ",";
    }
  return { signature, opaque };
})()`;

const globeSignatureSchema = z.object({ signature: z.string(), opaque: z.number() }).nullable();

export type GlobeSignature = z.infer<typeof globeSignatureSchema>;

export async function hasGlobe(page: Page): Promise<boolean> {
  return (await page.locator(globeCanvasSelector).count()) > 0;
}

export async function readGlobeSignature(page: Page): Promise<GlobeSignature> {
  const signature: unknown = await page.evaluate(globeSignatureExpression);

  return globeSignatureSchema.parse(signature);
}

const markRowsSchema = z.array(
  z.object({ user_id: z.string(), code: z.string(), state: z.string() }),
);

export type MarkRow = z.infer<typeof markRowsSchema>[number];

function queryDatabase(sql: string): unknown[] {
  const database = new Database(databasePath(), { readonly: true });

  try {
    return database.query(sql).all();
  } finally {
    database.close();
  }
}

export function markTableExists(): boolean {
  return (
    queryDatabase("select name from sqlite_master where type = 'table' and name = 'marks'")
      .length === 1
  );
}

export function readMarkRows(): MarkRow[] {
  return markRowsSchema.parse(
    queryDatabase("select user_id, code, state from marks order by code"),
  );
}
