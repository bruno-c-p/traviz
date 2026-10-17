import { parseArgs } from "node:util";
import type { Page } from "playwright-core";
import { COUNTRIES_BY_CODE } from "@/features/countries";
import { openPage, openRoute, readMarkRows, settle, signIn } from "@/shared/testing/verify/browser";
import { runJourney } from "@/shared/testing/verify/journal";
import { listPath } from "@/paths";

const { values: options } = parseArgs({ options: { code: { type: "string", default: "JPN" } } });

const code = options.code.toUpperCase();
const country = COUNTRIES_BY_CODE.get(code);

if (!country) {
  console.error(`No country has the code ${code}.`);
  process.exit(1);
}

const countryName = country.name;
const initialState = readMarkRows().find((row) => row.code === code)?.state;

if (initialState !== undefined) {
  console.error(`FAIL precondition: ${code} already has a marks row (${initialState}).`);
  process.exit(1);
}

async function waitForRow(expected: string | undefined): Promise<string | undefined> {
  const deadline = Date.now() + 5_000;
  let state = readMarkRows().find((row) => row.code === code)?.state;

  while (state !== expected && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    state = readMarkRows().find((row) => row.code === code)?.state;
  }

  return state;
}

function pressedIs(value: string | null, expected: string): [boolean, string] {
  return [value === expected, `aria-pressed=${value ?? "missing"}`];
}

function rowIs(state: string | undefined, expected: string | undefined): [boolean, string] {
  return [state === expected, `${code} row state ${state ?? "none"} in the worktree database`];
}

async function findVisitedButton(page: Page, baseUrl: string) {
  await openRoute(page, baseUrl, listPath());
  await page.getByRole("textbox", { name: "Search countries" }).fill(countryName);
  await settle(page);

  return page
    .getByRole("group", { name: `Mark ${countryName}`, exact: true })
    .getByRole("button", { name: "Visited", exact: true });
}

await runJourney(`mark-from-list-${code}`, "reduce", async (journal, page, browser, baseUrl) => {
  try {
    const visited = await findVisitedButton(page, baseUrl);

    await journal.screenshot(page, "1-filtered");
    await visited.click();
    await settle(page);
    journal.record(
      "the Visited button is pressed after the click",
      ...pressedIs(await visited.getAttribute("aria-pressed"), "true"),
    );
    journal.record("the marks row says visited", ...rowIs(await waitForRow("visited"), "visited"));
    await journal.screenshot(page, "2-marked");

    const fresh = await openPage(browser, 1440, "reduce");

    await signIn(fresh.page, baseUrl);

    const freshVisited = await findVisitedButton(fresh.page, baseUrl);

    journal.record(
      "a new session with empty storage shows the mark from the server",
      ...pressedIs(await freshVisited.getAttribute("aria-pressed"), "true"),
    );
    await journal.screenshot(fresh.page, "3-new-session");
    journal.record(
      "the new session loaded without console errors or failed requests",
      fresh.problems.length === 0,
      fresh.problems.join(" | ") || "none",
    );
    await fresh.page.context().close();
    await visited.click();
    await settle(page);
    journal.record(
      "a second click clears the mark",
      ...pressedIs(await visited.getAttribute("aria-pressed"), "false"),
    );
    journal.record("the marks row is gone", ...rowIs(await waitForRow(undefined), undefined));
    await journal.screenshot(page, "4-cleared");
  } finally {
    const leftover = readMarkRows().find((row) => row.code === code);

    if (leftover)
      journal.record(
        "the journey left no mark behind",
        false,
        `${code} is still ${leftover.state}. Clear it on /list or with Reset all data on /stats.`,
      );
  }
});
