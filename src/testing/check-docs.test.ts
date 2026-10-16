import { afterAll, expect, test } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const checkDocsScript = join(import.meta.dir, "..", "..", "scripts", "check-docs.ts");
const fixtureRoots: string[] = [];

function createDocsFixture(agentsText: string): string {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "check-docs-"));
  fixtureRoots.push(fixtureRoot);

  writeFileSync(
    join(fixtureRoot, "package.json"),
    JSON.stringify({ scripts: { test: "bun test" } }),
  );
  writeFileSync(join(fixtureRoot, "AGENTS.md"), agentsText);
  writeFileSync(join(fixtureRoot, "README.md"), "# Fixture\n");
  execFileSync("git", ["init", "--quiet"], { cwd: fixtureRoot });

  return fixtureRoot;
}

function runCheckDocs(fixtureRoot: string) {
  const result = spawnSync(process.execPath, [checkDocsScript, "--root", fixtureRoot], {
    encoding: "utf8",
  });

  return { exitCode: result.status, output: result.stdout + result.stderr };
}

afterAll(() => {
  for (const fixtureRoot of fixtureRoots) rmSync(fixtureRoot, { recursive: true, force: true });
});

test("check:docs passes when every path and script exists", () => {
  const fixtureRoot = createDocsFixture("Run `bun run test` and read `README.md`.\n");

  const { exitCode, output } = runCheckDocs(fixtureRoot);

  expect(output).toContain("0 broken");
  expect(exitCode).toBe(0);
});

test("check:docs fails on a missing path and a missing script", () => {
  const fixtureRoot = createDocsFixture("Run `bun run lint:fix`, then edit src/lib/db.ts.\n");
  const { exitCode, output } = runCheckDocs(fixtureRoot);

  expect(output).toContain("AGENTS.md:1 script lint:fix");
  expect(output).toContain("AGENTS.md:1 path src/lib/db.ts");
  expect(exitCode).toBe(1);
});
