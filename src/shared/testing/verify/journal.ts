import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Browser, Page } from "playwright-core";
import { launchBrowser, openPage, signIn, type Motion } from "@/shared/testing/verify/browser";
import { evidenceDirectory, requireBaseUrl } from "@/shared/testing/verify/instance";

type Entry = { step: string; ok: boolean; detail: string };

export class Journal {
  private readonly entries: Entry[] = [];

  readonly directory: string;

  constructor(directory: string) {
    this.directory = directory;
  }

  record(step: string, ok: boolean, detail: string): void {
    this.entries.push({ step, ok, detail });
    console.log(`${ok ? "ok  " : "FAIL"} ${step}: ${detail}`);
  }

  async screenshot(page: Page, name: string): Promise<void> {
    await page.screenshot({ path: join(this.directory, `${name}.png`) });
  }

  finish(problems: string[]): void {
    this.record(
      "no console errors or failed requests",
      problems.length === 0,
      problems.join(" | ") || "none",
    );
    writeFileSync(join(this.directory, "journal.json"), JSON.stringify(this.entries, null, 2));
    console.log(`evidence in ${this.directory}`);

    if (this.entries.some((entry) => !entry.ok)) process.exitCode = 1;
  }
}

export type JourneyBody = (
  journal: Journal,
  page: Page,
  browser: Browser,
  baseUrl: string,
) => Promise<void>;

export async function runJourney(label: string, motion: Motion, body: JourneyBody): Promise<void> {
  const baseUrl = requireBaseUrl();
  const journal = new Journal(evidenceDirectory(label));
  let problems: string[] = [];

  const browser = await launchBrowser().catch((cause: unknown) => {
    journal.record(
      "Chrome launched",
      false,
      cause instanceof Error ? cause.message : String(cause),
    );
  });

  try {
    if (browser) {
      const driven = await openPage(browser, 1440, motion);

      problems = driven.problems;
      await signIn(driven.page, baseUrl);
      await body(journal, driven.page, browser, baseUrl);
    }
  } catch (cause: unknown) {
    journal.record(
      "the journey ran to the end",
      false,
      cause instanceof Error ? cause.message : String(cause),
    );
  } finally {
    journal.finish(problems);
    await browser?.close();
  }
}
