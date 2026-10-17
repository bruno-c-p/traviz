import { writeFileSync } from "node:fs";
import { join } from "node:path";

type Entry = { step: string; ok: boolean; detail: string };

export class Journal {
  private readonly entries: Entry[] = [];

  record(step: string, ok: boolean, detail: string): void {
    this.entries.push({ step, ok, detail });
    console.log(`${ok ? "ok  " : "FAIL"} ${step}: ${detail}`);
  }

  finish(directory: string, problems: string[]): void {
    this.record(
      "no console errors or failed requests",
      problems.length === 0,
      problems.join(" | ") || "none",
    );
    writeFileSync(join(directory, "journal.json"), JSON.stringify(this.entries, null, 2));
    console.log(`evidence in ${directory}`);

    if (this.entries.some((entry) => !entry.ok)) process.exitCode = 1;
  }
}
