import { afterAll, expect, test } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const checkGatesScript = join(import.meta.dir, "..", "..", "scripts", "check-gates.ts");
const fixtureRoots: string[] = [];

const ciWorkflow = `name: CI
on: pull_request
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.4.3
      - run: bun run check
`;

const oxlintConfig = {
  categories: { correctness: "error" },
  rules: { "no-debugger": "error" },
  overrides: [{ files: ["src/list.tsx"], rules: { "react/incompatible-library": "off" } }],
};

const lintExemptions = [
  { files: ["src/list.tsx"], rule: "react/incompatible-library", reason: "Compiler is off." },
];

const passingFiles = {
  ".github/workflows/ci.yml": ciWorkflow,
  "tsconfig.json": '{\n  "compilerOptions": {\n    /* Linting */\n    "strict": true\n  }\n}\n',
  ".oxlintrc.json": JSON.stringify(oxlintConfig),
  "lint-exemptions.json": JSON.stringify(lintExemptions),
  ".fallowrc.json": JSON.stringify({ health: { maxCrap: 73 } }),
  "doctor.config.json": JSON.stringify({ blocking: "warning" }),
  "package.json": JSON.stringify({
    devEngines: { packageManager: { name: "bun", version: "1.4.3" } },
  }),
  "src/list.tsx": "export {};\n",
};

function runCheckGates(changedFiles: Record<string, string | null> = {}) {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "check-gates-"));
  fixtureRoots.push(fixtureRoot);

  for (const [filePath, contents] of Object.entries({ ...passingFiles, ...changedFiles })) {
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

afterAll(() => {
  for (const fixtureRoot of fixtureRoots) rmSync(fixtureRoot, { recursive: true, force: true });
});

test("check:gates passes when every gate is at its floor", () => {
  const { exitCode, output } = runCheckGates();

  expect(output).toContain("check:gates 0 loosened");
  expect(exitCode).toBe(0);
});

test("check:gates fails on continue-on-error in any workflow", () => {
  const { exitCode, output } = runCheckGates({
    ".github/workflows/scratch.yaml": ciWorkflow.replace(
      "runs-on: ubuntu-latest",
      "runs-on: ubuntu-latest\n    continue-on-error: true",
    ),
  });

  expect(output).toContain(".github/workflows/scratch.yaml uses continue-on-error");
  expect(exitCode).toBe(1);
});

test("check:gates fails when strict is off or missing", () => {
  expect(
    runCheckGates({ "tsconfig.json": '{ "compilerOptions": { "strict": false } }' }).output,
  ).toContain("tsconfig.json must set compilerOptions.strict to true");
  expect(runCheckGates({ "tsconfig.json": '{ "compilerOptions": {} }' }).exitCode).toBe(1);
});

test("check:gates fails on a rule downgraded to warn", () => {
  const { exitCode, output } = runCheckGates({
    ".oxlintrc.json": JSON.stringify({ ...oxlintConfig, rules: { "no-debugger": "warn" } }),
  });

  expect(output).toContain(".oxlintrc.json sets no-debugger to warn");
  expect(output).toContain("oxlint resolves no-debugger to warn");
  expect(exitCode).toBe(1);
});

test("check:gates fails when the correctness category falls back to warn", () => {
  const { exitCode, output } = runCheckGates({
    ".oxlintrc.json": JSON.stringify({ ...oxlintConfig, categories: {} }),
  });

  expect(output).toContain('must set categories.correctness to "error"');
  expect(output).toContain("oxlint resolves for-direction to warn");
  expect(exitCode).toBe(1);
});

test("check:gates fails on a rule turned off globally or in an unlisted override", () => {
  const { exitCode, output } = runCheckGates({
    ".oxlintrc.json": JSON.stringify({
      ...oxlintConfig,
      rules: { "no-debugger": "off" },
      overrides: [
        ...oxlintConfig.overrides,
        { files: ["src/list.tsx"], rules: { "no-debugger": "off" } },
      ],
    }),
  });

  expect(output).toContain(".oxlintrc.json sets no-debugger to off; every configured rule");
  expect(output).toContain(
    "sets no-debugger to off for src/list.tsx without an entry in lint-exemptions.json",
  );
  expect(exitCode).toBe(1);
});

test("check:gates fails on an exemption whose file no longer exists", () => {
  const { exitCode, output } = runCheckGates({ "src/list.tsx": null });

  expect(output).toContain(
    "lint-exemptions.json names src/list.tsx, which matches no tracked file",
  );
  expect(exitCode).toBe(1);
});

test("check:gates fails on an exemption with no matching override", () => {
  const { exitCode, output } = runCheckGates({
    ".oxlintrc.json": JSON.stringify({ ...oxlintConfig, overrides: [] }),
  });

  expect(output).toContain("but .oxlintrc.json has no matching override");
  expect(exitCode).toBe(1);
});

test("check:gates fails when maxCrap rises above 73", () => {
  const { exitCode, output } = runCheckGates({
    ".fallowrc.json": JSON.stringify({ health: { maxCrap: 90 } }),
  });

  expect(output).toContain(".fallowrc.json must set health.maxCrap to 73 or lower");
  expect(exitCode).toBe(1);
});

test("check:gates fails when react-doctor blocks on less than warnings", () => {
  const { exitCode, output } = runCheckGates({
    "doctor.config.json": JSON.stringify({ blocking: "error" }),
  });

  expect(output).toContain('doctor.config.json must set blocking to "warning"');
  expect(exitCode).toBe(1);
});

test("check:gates fails on a tracked foreign lockfile", () => {
  const { exitCode, output } = runCheckGates({
    "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
    "tools/package-lock.json": "{}",
  });

  expect(output).toContain("pnpm-lock.yaml is tracked");
  expect(output).toContain("tools/package-lock.json is tracked");
  expect(exitCode).toBe(1);
});

test("check:gates fails when the bun pin is missing or differs from CI", () => {
  expect(runCheckGates({ "package.json": "{}" }).output).toContain(
    "package.json must pin bun in devEngines.packageManager",
  );
  expect(
    runCheckGates({
      ".github/workflows/ci.yml": ciWorkflow.replace("bun-version: 1.4.3", "bun-version: latest"),
    }).output,
  ).toContain("CI sets bun-version latest, but devEngines.packageManager.version is 1.4.3");
});
