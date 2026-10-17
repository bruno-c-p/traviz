import { join } from "node:path";
import { parseArgs } from "node:util";
import {
  launchBrowser,
  openPage,
  readMarkRows,
  settle,
  signIn,
} from "@/shared/testing/verify/browser";
import { evidenceDirectory, requireBaseUrl } from "@/shared/testing/verify/instance";
import { Journal } from "@/shared/testing/verify/journal";
import { listPath } from "@/paths";

const { values: options } = parseArgs({
  options: {
    code: { type: "string", default: "JPN" },
    name: { type: "string", default: "Japan" },
  },
});

const { code, name } = options;
const baseUrl = requireBaseUrl();
const directory = evidenceDirectory(`mark-from-list-${code}`);
const journal = new Journal();

async function waitForRow(expected: string | undefined): Promise<string | undefined> {
  const deadline = Date.now() + 5_000;
  let state = readMarkRows().find((row) => row.code === code)?.state;

  while (state !== expected && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    state = readMarkRows().find((row) => row.code === code)?.state;
  }

  return state;
}

const initialState = readMarkRows().find((row) => row.code === code)?.state;

journal.record(
  "precondition: no marks row for the country",
  initialState === undefined,
  `row state ${initialState ?? "none"}`,
);

if (initialState !== undefined) {
  journal.finish(directory, []);
  process.exit();
}

const browser = await launchBrowser();
const { page, problems } = await openPage(browser, 1440, "reduce");

await signIn(page, baseUrl);

await page.goto(baseUrl + listPath(), { waitUntil: "networkidle" });

await page.getByRole("textbox", { name: "Search countries" }).fill(name);

await settle(page);

const group = page.getByRole("group", { name: `Mark ${name}` });
const visited = group.getByRole("button", { name: "Visited", exact: true });

await page.screenshot({ path: join(directory, "1-filtered.png") });

await visited.click();

await settle(page);

journal.record(
  "the Visited button is pressed after the click",
  (await visited.getAttribute("aria-pressed")) === "true",
  "aria-pressed",
);

journal.record(
  "the marks row says visited",
  (await waitForRow("visited")) === "visited",
  `${code} in .data/dev.db`,
);

await page.screenshot({ path: join(directory, "2-marked.png") });

await page.reload({ waitUntil: "networkidle" });

await page.getByRole("textbox", { name: "Search countries" }).fill(name);

await settle(page);

journal.record(
  "the mark survives a reload",
  (await visited.getAttribute("aria-pressed")) === "true",
  "aria-pressed after reload",
);

await page.screenshot({ path: join(directory, "3-reloaded.png") });

await visited.click();

await settle(page);

journal.record(
  "a second click clears the mark",
  (await visited.getAttribute("aria-pressed")) === "false",
  "aria-pressed",
);

journal.record(
  "the marks row is gone",
  (await waitForRow(undefined)) === undefined,
  `${code} in .data/dev.db`,
);

await page.screenshot({ path: join(directory, "4-cleared.png") });

await browser.close();

journal.finish(directory, problems);
