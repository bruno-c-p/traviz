import { afterAll, expect, test } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const repoRoot = join(import.meta.dir, "..", "..");
const checkGatesScript = join(repoRoot, "scripts", "check-gates.ts");
const fixtureRoots: string[] = [];

const gateFiles = [
  ".github/workflows/ci.yml",
  "tsconfig.json",
  ".oxlintrc.json",
  "lint-exemptions.json",
  ".fallowrc.json",
  "doctor.config.json",
  "package.json",
];

const exemptedFiles = [
  "paths.ts",
  "src/components/virtual-country-list.tsx",
  "src/example.test.ts",
  "src/example.test.tsx",
  "src/testing/example.ts",
  "scripts/example.ts",
];

const repoFiles = new Map<string, string>([
  ...gateFiles.map((filePath): [string, string] => [
    filePath,
    readFileSync(join(repoRoot, filePath), "utf8"),
  ]),
  ...exemptedFiles.map((filePath): [string, string] => [filePath, "export {};\n"]),
]);

function repoFile(filePath: string): string {
  return repoFiles.get(filePath) ?? "";
}

function edit(filePath: string, search: string, replacement: string): [string, string] {
  const contents = repoFile(filePath);

  if (!contents.includes(search)) throw new Error(`${filePath} does not contain ${search}`);

  return [filePath, contents.replace(search, replacement)];
}

function runCheckGates(...changes: [string, string | null][]) {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "check-gates-"));
  fixtureRoots.push(fixtureRoot);

  const files = new Map<string, string | null>([...repoFiles, ...changes]);

  for (const [filePath, contents] of files) {
    if (contents === null) continue;

    mkdirSync(dirname(join(fixtureRoot, filePath)), { recursive: true });
    writeFileSync(join(fixtureRoot, filePath), contents);
  }

  execFileSync("git", ["init", "--quiet"], { cwd: fixtureRoot });
  execFileSync("git", ["add", "."], { cwd: fixtureRoot });

  const result = spawnSync(process.execPath, [checkGatesScript, "--root", fixtureRoot], {
    encoding: "utf8",
  });

  return { exitCode: result.status, output: result.stdout + result.stderr };
}

function expectFailure(expectedText: string, ...changes: [string, string | null][]) {
  const { exitCode, output } = runCheckGates(...changes);

  expect(output).toContain(expectedText);
  expect(exitCode).toBe(1);
}

afterAll(() => {
  for (const fixtureRoot of fixtureRoots) rmSync(fixtureRoot, { recursive: true, force: true });
});

test("check:gates passes on the repo's gate files", () => {
  const { exitCode, output } = runCheckGates();

  expect(output).toContain("check:gates 0 loosened");
  expect(exitCode).toBe(0);
});

test("check:gates fails on continue-on-error in any workflow, however it is spelled", () => {
  expectFailure(".github/workflows/scratch.yml uses continue-on-error", [
    ".github/workflows/scratch.yml",
    repoFile(".github/workflows/ci.yml").replace(
      "runs-on: ubuntu-latest",
      "runs-on: ubuntu-latest\n    continue-on-error: true",
    ),
  ]);
  expectFailure(
    ".github/workflows/ci.yml uses continue-on-error",
    edit(
      ".github/workflows/ci.yml",
      "runs-on: ubuntu-latest",
      'runs-on: ubuntu-latest\n    "continue\\u002Don\\u002Derror": true',
    ),
  );
  expectFailure(".github/actions/setup/action.yml uses continue-on-error", [
    ".github/actions/setup/action.yml",
    "runs:\n  using: composite\n  steps:\n    - run: bun install\n      continue-on-error: true\n",
  ]);
});

test("check:gates fails when CI stops running a gate", () => {
  expectFailure(
    'job check must run "bun run check" unconditionally',
    edit(".github/workflows/ci.yml", "run: bun run check", "run: bun run check || true"),
  );
  expectFailure(
    'job check must run "bun run fallow"',
    edit(".github/workflows/ci.yml", "run: bun run fallow", "run: echo skipped"),
  );
});

test("check:gates fails when a gate script is loosened", () => {
  expectFailure(
    "package.json script lint is",
    edit(
      "package.json",
      '"lint": "oxlint --type-aware --deny-warnings"',
      '"lint": "oxlint --type-aware -A all"',
    ),
  );
  expectFailure(
    "package.json script check is",
    edit("package.json", '"check": "bun run check:gates && ', '"check": "'),
  );
});

test("check:gates fails when strict is off or weakened", () => {
  expectFailure(
    "tsconfig.json must set compilerOptions.strict to true",
    edit("tsconfig.json", '"strict": true', '"strict": false'),
  );
  expectFailure(
    "tsconfig.json turns strictNullChecks off under strict",
    edit("tsconfig.json", '"strict": true', '"strict": true,\n    "strictNullChecks": false'),
  );
  expectFailure(
    "tsconfig.json include is",
    edit("tsconfig.json", '"include": ["src", ', '"include": ['),
  );
});

test("check:gates fails on a rule or category below error", () => {
  expectFailure(
    ".oxlintrc.json sets typescript/no-explicit-any to warn",
    edit(
      ".oxlintrc.json",
      '"typescript/no-explicit-any": "error"',
      '"typescript/no-explicit-any": "warn"',
    ),
  );
  expectFailure(
    '.oxlintrc.json must set categories.correctness to "error"',
    edit(".oxlintrc.json", '"categories": { "correctness": "error" },', ""),
  );
});

test("check:gates fails on a rule turned off globally or in an unlisted override", () => {
  expectFailure(
    ".oxlintrc.json sets typescript/no-explicit-any to off; every configured rule",
    edit(
      ".oxlintrc.json",
      '"typescript/no-explicit-any": "error"',
      '"typescript/no-explicit-any": "off"',
    ),
  );
  expectFailure(
    "sets no-debugger to off for src/components/virtual-country-list.tsx without an entry",
    edit(
      ".oxlintrc.json",
      '"react/incompatible-library": "off" }',
      '"react/incompatible-library": "off", "no-debugger": "off" }',
    ),
  );
});

test("check:gates fails on oxlint config that loosens rules from elsewhere", () => {
  expectFailure("src/.oxlintrc.json is an extra oxlint config", [
    "src/.oxlintrc.json",
    '{ "rules": { "typescript/no-explicit-any": "off" } }',
  ]);
  expectFailure(
    ".oxlintrc.json has a key or shape check:gates does not know",
    edit(".oxlintrc.json", '"plugins":', '"extends": ["./base.json"],\n  "plugins":'),
  );
  expectFailure(
    ".oxlintrc.json ignorePatterns is",
    edit(
      ".oxlintrc.json",
      '"ignorePatterns": ["tools/oxlint/anti-slop/**"]',
      '"ignorePatterns": ["src/**"]',
    ),
  );
  expectFailure(
    ".oxlintrc.json plugins is",
    edit(".oxlintrc.json", '"plugins": ["react", "typescript", "oxc"]', '"plugins": ["react"]'),
  );
});

test("check:gates fails on an exemption whose file or override is gone", () => {
  expectFailure(
    "lint-exemptions.json names src/components/virtual-country-list.tsx, which matches no tracked file",
    ["src/components/virtual-country-list.tsx", null],
  );
  expectFailure(
    "lists react/incompatible-library for src/components/virtual-country-list.tsx, but .oxlintrc.json has no matching override",
    edit(
      ".oxlintrc.json",
      '"react/incompatible-library": "off"',
      '"react/incompatible-library": "error"',
    ),
  );
});

test("check:gates fails when fallow or react-doctor is loosened", () => {
  expectFailure(
    ".fallowrc.json must set health.maxCrap to 73 or lower",
    edit(".fallowrc.json", '"maxCrap": 73', '"maxCrap": 90'),
  );
  expectFailure(
    ".fallowrc.json (besides health) is",
    edit(
      ".fallowrc.json",
      '"ignorePatterns": ["tools/**"]',
      '"ignorePatterns": ["tools/**", "src/**"]',
    ),
  );
  expectFailure(
    "doctor.config.json is",
    edit("doctor.config.json", '"blocking": "warning"', '"blocking": "error"'),
  );
});

test("check:gates fails on a tracked foreign lockfile", () => {
  expectFailure("pnpm-lock.yaml is tracked", ["pnpm-lock.yaml", "lockfileVersion: '9.0'\n"]);
  expectFailure("tools/npm-shrinkwrap.json is tracked", ["tools/npm-shrinkwrap.json", "{}"]);
});

test("check:gates fails when the bun pin is missing or differs from CI", () => {
  expectFailure(
    "package.json must pin bun in devEngines.packageManager",
    edit("package.json", '"name": "bun",', '"name": "npm",'),
  );
  expectFailure(
    "CI sets bun-version latest, but devEngines.packageManager.version is 1.4.3",
    edit(".github/workflows/ci.yml", "bun-version: 1.4.3", "bun-version: latest"),
  );
});
