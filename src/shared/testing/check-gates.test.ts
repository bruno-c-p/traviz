import { afterAll, expect, test } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const repoRoot = join(import.meta.dir, "..", "..", "..");
const checkGatesScript = join(repoRoot, "scripts", "check-gates.ts");
const fixtureRoots: string[] = [];

const gateFiles = [
  "gates.json",
  ".oxfmtrc.json",
  "bunfig.toml",
  ".gitignore",
  ".github/workflows/ci.yml",
  "tsconfig.json",
  "tsconfig.pure.json",
  ".oxlintrc.json",
  "lint-exemptions.json",
  ".fallowrc.json",
  "doctor.config.json",
  "package.json",
];

const exemptedFiles = [
  "paths.ts",
  "src/features/country-list/virtual-country-list.tsx",
  "src/example.test.ts",
  "src/example.test.tsx",
  "src/shared/testing/example.ts",
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
  execFileSync("git", ["add", "--force", "."], { cwd: fixtureRoot });

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
    ".github/workflows/ci.yml.jobs.check.steps differs from gates.json",
    edit(".github/workflows/ci.yml", "run: bun run check", "run: bun run check || true"),
  );
  expectFailure(
    ".github/workflows/ci.yml.jobs.check.steps differs from gates.json",
    edit(".github/workflows/ci.yml", "run: bun run fallow", "run: echo skipped"),
  );
});

test("check:gates fails when a gate script is loosened", () => {
  expectFailure(
    "package.json script lint differs from gates.json",
    edit(
      "package.json",
      '"lint": "oxlint --type-aware --deny-warnings"',
      '"lint": "oxlint --type-aware -A all"',
    ),
  );
  expectFailure(
    "package.json script check differs from gates.json",
    edit("package.json", '"check": "bun run check:gates && ', '"check": "'),
  );
});

test("check:gates fails when strict is off or weakened", () => {
  expectFailure(
    "tsconfig.json must set compilerOptions.strict to true",
    edit("tsconfig.json", '"strict": true', '"strict": false'),
  );
  expectFailure(
    "tsconfig.json.compilerOptions.strictNullChecks differs from gates.json",
    edit("tsconfig.json", '"strict": true', '"strict": true,\n    "strictNullChecks": false'),
  );
  expectFailure(
    "tsconfig.json.include differs from gates.json",
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
    "sets no-debugger to off for src/features/country-list/virtual-country-list.tsx without an entry",
    edit(
      ".oxlintrc.json",
      '"react/incompatible-library": "off" }',
      '"react/incompatible-library": "off", "no-debugger": "off" }',
    ),
  );
});

test("check:gates fails on oxlint config that loosens rules from elsewhere", () => {
  expectFailure("src/.oxlintrc.json changes what oxlint or oxfmt checks outside gates.json", [
    "src/.oxlintrc.json",
    '{ "rules": { "typescript/no-explicit-any": "off" } }',
  ]);
  expectFailure(
    ".oxlintrc.json.extends differs from gates.json",
    edit(".oxlintrc.json", '"plugins":', '"extends": ["./base.json"],\n  "plugins":'),
  );
  expectFailure(
    ".oxlintrc.json.ignorePatterns differs from gates.json",
    edit(
      ".oxlintrc.json",
      '"ignorePatterns": ["tools/oxlint/anti-slop/**"]',
      '"ignorePatterns": ["src/**"]',
    ),
  );
  expectFailure(
    ".oxlintrc.json.plugins differs from gates.json",
    edit(
      ".oxlintrc.json",
      '"plugins": ["react", "typescript", "oxc", "unicorn", "import"]',
      '"plugins": ["react"]',
    ),
  );
});

test("check:gates fails on an exemption whose file or override is gone", () => {
  expectFailure(
    "lint-exemptions.json names src/features/country-list/virtual-country-list.tsx, which matches no tracked file",
    ["src/features/country-list/virtual-country-list.tsx", null],
  );
  expectFailure(
    "lists react/incompatible-library for src/features/country-list/virtual-country-list.tsx, but .oxlintrc.json has no matching override",
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
    ".fallowrc.json.ignorePatterns differs from gates.json",
    edit(
      ".fallowrc.json",
      '"ignorePatterns": ["tools/**"]',
      '"ignorePatterns": ["tools/**", "src/**"]',
    ),
  );
  expectFailure(
    'doctor.config.json must set blocking to "warning"',
    edit("doctor.config.json", '"blocking": "warning"', '"blocking": "error"'),
  );
});

test("check:gates fails on a tracked foreign lockfile", () => {
  expectFailure("pnpm-lock.yaml is tracked", ["pnpm-lock.yaml", "lockfileVersion: '9.0'\n"]);
  expectFailure("tools/npm-shrinkwrap.json is tracked", ["tools/npm-shrinkwrap.json", "{}"]);
});

test("check:gates fails when the bun pin is missing or differs from CI", () => {
  expectFailure(
    "package.json devEngines differs from gates.json",
    edit("package.json", '"name": "bun",', '"name": "npm",'),
  );
  expectFailure(
    "CI sets bun-version latest, but devEngines.packageManager.version is 1.4.3",
    edit(".github/workflows/ci.yml", "bun-version: 1.4.3", "bun-version: latest"),
  );
});

test("check:gates fails on a removed rule, weaker rule options and noCheck", () => {
  expectFailure(
    ".oxlintrc.json.rules.typescript/no-explicit-any differs from gates.json",
    edit(".oxlintrc.json", '"typescript/no-explicit-any": "error",', ""),
  );
  expectFailure(
    ".oxlintrc.json.rules.typescript/consistent-type-assertions differs from gates.json",
    edit(".oxlintrc.json", '{ "assertionStyle": "never" }', '{ "assertionStyle": "as" }'),
  );
  expectFailure(
    "tsconfig.json.compilerOptions.noCheck differs from gates.json",
    edit("tsconfig.json", '"strict": true', '"strict": true,\n    "noCheck": true'),
  );
});

test("check:gates fails when CI skips the check job or the format gate", () => {
  expectFailure(
    ".github/workflows/ci.yml.jobs.check.if differs from gates.json",
    edit(
      ".github/workflows/ci.yml",
      "runs-on: ubuntu-latest",
      "runs-on: ubuntu-latest\n    if: false",
    ),
  );
  expectFailure(
    ".github/workflows/ci.yml.on.pull_request differs from gates.json",
    edit(".github/workflows/ci.yml", "  pull_request:\n", ""),
  );
  expectFailure(
    "package.json script format differs from gates.json",
    edit("package.json", '"format": "oxfmt ."', '"format": "true"'),
  );
  expectFailure(
    "package.json adds precheck, which runs around the check gate",
    edit("package.json", '"scripts": {', '"scripts": {\n    "precheck": "true",'),
  );
});

test("check:gates fails on lint switched off outside .oxlintrc.json", () => {
  expectFailure(".eslintignore changes what oxlint or oxfmt checks outside gates.json", [
    ".eslintignore",
    "src/**\n",
  ]);
  expectFailure("src/probe.ts disables lint inline; use lint-exemptions.json", [
    "src/probe.ts",
    `/* ${["oxlint", "disable"].join("-")} */\nexport const probe = 1;\n`,
  ]);
});

test("check:gates fails when the format, test or ignore config narrows a gate", () => {
  expectFailure(
    ".oxfmtrc.json.ignorePatterns differs from gates.json",
    edit(".oxfmtrc.json", '"tools/oxlint/anti-slop/**"', '"tools/oxlint/anti-slop/**", "src/**"'),
  );
  expectFailure(
    "bunfig.toml.test.pathIgnorePatterns differs from gates.json",
    edit("bunfig.toml", 'root = "src"', 'root = "src"\npathIgnorePatterns = ["**/probe.test.ts"]'),
  );
  expectFailure(
    "src/example.test.ts is tracked but matches .gitignore, so lint and format skip it",
    [".gitignore", `${repoFile(".gitignore")}\nsrc/example.test.ts\n`],
  );
  expectFailure(".prettierignore changes what oxlint or oxfmt checks outside gates.json", [
    ".prettierignore",
    "src/**\n",
  ]);
  expectFailure("tools/oxlint/probe.ts disables lint inline; use lint-exemptions.json", [
    "tools/oxlint/probe.ts",
    `/* ${["oxlint", "disable"].join("-")} */\nexport const probe = 1;\n`,
  ]);
});

test("check:gates exempts a rule only for the files its exemption lists", () => {
  expectFailure(
    "sets react/incompatible-library to off for src/example.test.ts without an entry in lint-exemptions.json",
    edit(
      ".oxlintrc.json",
      '"overrides": [',
      '"overrides": [\n    { "files": ["src/example.test.ts"], "rules": { "react/incompatible-library": "off" } },',
    ),
  );
});

test("check:gates fails on a category below error, a CI without setup-bun and a root action.yml", () => {
  expectFailure(
    ".oxlintrc.json sets category suspicious to warn",
    edit(
      ".oxlintrc.json",
      '"categories": { "correctness": "error" }',
      '"categories": { "correctness": "error", "suspicious": "warn" }',
    ),
  );
  expectFailure(
    "no workflow step sets up bun with oven-sh/setup-bun",
    edit(
      ".github/workflows/ci.yml",
      "      - uses: oven-sh/setup-bun@v2\n        with:\n          bun-version: 1.4.3\n",
      "",
    ),
  );
  expectFailure("action.yml uses continue-on-error", [
    "action.yml",
    "runs:\n  using: composite\n  steps:\n    - run: bun install\n      continue-on-error: true\n",
  ]);
});

test("check:gates fails when an exemption's override covers other files", () => {
  expectFailure(
    "lists react/incompatible-library for src/features/country-list/virtual-country-list.tsx, but .oxlintrc.json has no matching override",
    edit(
      ".oxlintrc.json",
      '"files": ["src/features/country-list/virtual-country-list.tsx"]',
      '"files": ["src/features/country-list/*.tsx"]',
    ),
  );
});

test("check:gates fails when a boundaries rule or the bare-import rule is removed", () => {
  for (const rule of [
    "boundaries/feature-entry",
    "boundaries/no-comments",
    "boundaries/no-empty-import",
    "boundaries/server-only-module",
    "boundaries/use-server-placement",
  ])
    expectFailure(
      `.oxlintrc.json.rules.${rule} differs from gates.json`,
      edit(".oxlintrc.json", `"${rule}": "error",`, ""),
    );

  expectFailure(
    ".oxlintrc.json.rules.import/no-unassigned-import differs from gates.json",
    edit(".oxlintrc.json", '"server-only", "client-only"', '"server-only", "client-only", "**"'),
  );
  expectFailure(
    ".oxlintrc.json.jsPlugins differs from gates.json",
    edit(
      ".oxlintrc.json",
      '"specifier": "./tools/oxlint/boundaries/index.ts"',
      '"specifier": "./x.ts"',
    ),
  );
});
