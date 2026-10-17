import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename, join, matchesGlob, resolve } from "node:path";
import { isDeepStrictEqual, parseArgs } from "node:util";
import { z } from "zod";

const { values: options } = parseArgs({ options: { root: { type: "string" } } });
const root = resolve(options.root ?? join(import.meta.dirname, ".."));

const maxCrapCeiling = 73;

const foreignLockfiles = [
  "pnpm-lock.yaml",
  "package-lock.json",
  "npm-shrinkwrap.json",
  "yarn.lock",
];

const errorSeverities = new Set(["error", "deny", 2]);
const disabledSeverities = new Set(["off", "allow", 0]);

const extraLintConfigPattern =
  /(^|\/)(\.?oxlintrc(\.[a-z]+)?|oxlint\.config\.[cm]?[jt]s|\.eslintignore|\.prettierignore)$/;

const inlineDisablePattern = /(?:es|ox)lint-disable/;
const lintedSourcePattern = /\.(?:[cm]?[jt]sx?)$/;

const jsonSchema = z.json();

type JsonValue = z.infer<typeof jsonSchema>;

const failures: string[] = [];

function readText(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

function readConfig(relativePath: string): JsonValue {
  const text = readText(relativePath);

  if (/\.ya?ml$/.test(relativePath)) return jsonSchema.parse(Bun.YAML.parse(text));

  if (relativePath.endsWith(".toml")) return jsonSchema.parse(Bun.TOML.parse(text));

  return jsonSchema.parse(Bun.JSONC.parse(text));
}

function differingPaths(actual: JsonValue, expected: JsonValue, path: string): string[] {
  if (isDeepStrictEqual(actual, expected)) return [];

  const actualRecord = z.record(z.string(), jsonSchema).safeParse(actual);
  const expectedRecord = z.record(z.string(), jsonSchema).safeParse(expected);

  if (!actualRecord.success || !expectedRecord.success || Array.isArray(actual)) return [path];

  const keys = new Set([...Object.keys(actualRecord.data), ...Object.keys(expectedRecord.data)]);

  return [...keys].flatMap((key) => {
    const actualValue = actualRecord.data[key];
    const expectedValue = expectedRecord.data[key];

    if (actualValue === undefined || expectedValue === undefined) return [`${path}.${key}`];

    return differingPaths(actualValue, expectedValue, `${path}.${key}`);
  });
}

const bundleBudgetSchema = z.strictObject({
  tolerance: z.strictObject({ percent: z.number(), minBytes: z.number() }),
  routes: z.record(
    z.string(),
    z.strictObject({ firstLoadGzipBytes: z.number(), lazyGzipBytes: z.number() }),
  ),
});

const gatesSchema = z.strictObject({
  files: z.record(z.string(), jsonSchema),
  scripts: z.record(z.string(), z.string()),
  devEngines: jsonSchema,
  bundleBudget: bundleBudgetSchema,
});

const gates = gatesSchema.parse(JSON.parse(readText("gates.json")));

const pinnedBunVersion = z
  .object({ packageManager: z.object({ name: z.literal("bun"), version: z.string() }) })
  .parse(gates.devEngines).packageManager.version;

const trackedFiles = execFileSync("git", ["ls-files", "--cached"], { cwd: root, encoding: "utf8" })
  .split("\n")
  .filter((filePath) => filePath !== "");

for (const [filePath, expected] of Object.entries(gates.files)) {
  for (const differingPath of differingPaths(readConfig(filePath), expected, filePath))
    failures.push(
      `${differingPath} differs from gates.json. A tightening updates gates.json in the same change`,
    );
}

const bundleBudget = bundleBudgetSchema.parse(JSON.parse(readText("bundle-budget.json")));

const bundleBudgetRaiseHint =
  "A raise from bun run check:bundle --write copies bundle-budget.json into bundleBudget in gates.json in the same change";

function checkCeiling(name: string, actual: number, ceiling: number) {
  if (actual > ceiling)
    failures.push(
      `bundle-budget.json ${name} is ${actual}, above ${ceiling} in gates.json. ${bundleBudgetRaiseHint}`,
    );
}

for (const key of ["percent", "minBytes"] as const)
  checkCeiling(`tolerance.${key}`, bundleBudget.tolerance[key], gates.bundleBudget.tolerance[key]);

for (const [route, pinned] of Object.entries(gates.bundleBudget.routes)) {
  const routeBudget = bundleBudget.routes[route];

  if (routeBudget === undefined) {
    failures.push(`bundle-budget.json drops ${route}, which gates.json budgets`);
    continue;
  }

  checkCeiling(
    `${route} firstLoadGzipBytes`,
    routeBudget.firstLoadGzipBytes,
    pinned.firstLoadGzipBytes,
  );
  checkCeiling(`${route} lazyGzipBytes`, routeBudget.lazyGzipBytes, pinned.lazyGzipBytes);
}

for (const route of Object.keys(bundleBudget.routes)) {
  if (!(route in gates.bundleBudget.routes))
    failures.push(
      `bundle-budget.json budgets ${route}, which gates.json does not. ${bundleBudgetRaiseHint}`,
    );
}

const packageManifest = z
  .object({
    scripts: z.record(z.string(), z.string()),
    devEngines: jsonSchema.optional(),
  })
  .parse(JSON.parse(readText("package.json")));

for (const [scriptName, command] of Object.entries(gates.scripts)) {
  if (packageManifest.scripts[scriptName] !== command)
    failures.push(`package.json script ${scriptName} differs from gates.json`);

  for (const hookName of [`pre${scriptName}`, `post${scriptName}`]) {
    if (hookName in packageManifest.scripts)
      failures.push(`package.json adds ${hookName}, which runs around the ${scriptName} gate`);
  }
}

if (!isDeepStrictEqual(packageManifest.devEngines, gates.devEngines))
  failures.push("package.json devEngines differs from gates.json");

const workflowFiles = trackedFiles.filter(
  (filePath) =>
    /^\.github\/.*\.ya?ml$/.test(filePath) || /^action\.ya?ml$/.test(basename(filePath)),
);

const workflowStepsSchema = z.object({
  jobs: z.record(
    z.string(),
    z.object({
      steps: z
        .array(
          z.object({
            uses: z.string().optional(),
            with: z.record(z.string(), z.unknown()).optional(),
          }),
        )
        .optional(),
    }),
  ),
});

const ciBunVersions: string[] = [];

for (const workflowFile of workflowFiles) {
  const workflow = readConfig(workflowFile);

  if (JSON.stringify(workflow).includes('"continue-on-error":'))
    failures.push(`${workflowFile} uses continue-on-error, so a failing step would not fail CI`);

  for (const job of Object.values(workflowStepsSchema.safeParse(workflow).data?.jobs ?? {})) {
    for (const step of job.steps ?? []) {
      if (step.uses?.startsWith("oven-sh/setup-bun"))
        ciBunVersions.push(String(step.with?.["bun-version"]));
    }
  }
}

if (ciBunVersions.length === 0)
  failures.push("no workflow step sets up bun with oven-sh/setup-bun");

for (const ciBunVersion of ciBunVersions) {
  if (ciBunVersion !== pinnedBunVersion)
    failures.push(
      `CI sets bun-version ${ciBunVersion}, but devEngines.packageManager.version is ${pinnedBunVersion}`,
    );
}

const tsconfig = z
  .object({ compilerOptions: z.object({ strict: z.boolean().optional() }) })
  .parse(readConfig("tsconfig.json"));

if (tsconfig.compilerOptions.strict !== true)
  failures.push("tsconfig.json must set compilerOptions.strict to true");

const severitySchema = z.union([z.string(), z.number()]);
const ruleSettingSchema = z.union([severitySchema, z.tuple([severitySchema], z.unknown())]);
const rulesSchema = z.record(z.string(), ruleSettingSchema);

const oxlintConfig = z
  .object({
    categories: z.record(z.string(), severitySchema).default({}),
    rules: rulesSchema.default({}),
    overrides: z.array(z.object({ files: z.array(z.string()), rules: rulesSchema })).default([]),
  })
  .parse(readConfig(".oxlintrc.json"));

const exemptions = z
  .array(
    z.strictObject({
      files: z.array(z.string()).min(1),
      rule: z.string(),
      reason: z.string().min(1),
    }),
  )
  .parse(JSON.parse(readText("lint-exemptions.json")));

function severityOf(setting: z.infer<typeof ruleSettingSchema>) {
  return Array.isArray(setting) ? setting[0] : setting;
}

function filesKey(files: string[]): string {
  return JSON.stringify(files);
}

if (oxlintConfig.categories.correctness !== "error")
  failures.push('.oxlintrc.json must set categories.correctness to "error"');

for (const [category, severity] of Object.entries(oxlintConfig.categories)) {
  if (!errorSeverities.has(severity))
    failures.push(`.oxlintrc.json sets category ${category} to ${severity}`);
}

for (const [rule, setting] of Object.entries(oxlintConfig.rules)) {
  const severity = severityOf(setting);

  if (!errorSeverities.has(severity))
    failures.push(
      `.oxlintrc.json sets ${rule} to ${severity}; every configured rule must be error`,
    );
}

for (const override of oxlintConfig.overrides) {
  for (const [rule, setting] of Object.entries(override.rules)) {
    const severity = severityOf(setting);

    const isExempt = exemptions.some(
      (exemption) =>
        exemption.rule === rule && filesKey(exemption.files) === filesKey(override.files),
    );

    if (errorSeverities.has(severity) || (disabledSeverities.has(severity) && isExempt)) continue;

    failures.push(
      `.oxlintrc.json sets ${rule} to ${severity} for ${override.files.join(", ")} without an entry in lint-exemptions.json`,
    );
  }
}

for (const exemption of exemptions) {
  const hasOverride = oxlintConfig.overrides.some(
    (override) =>
      filesKey(override.files) === filesKey(exemption.files) &&
      disabledSeverities.has(severityOf(override.rules[exemption.rule] ?? "error")),
  );

  if (!hasOverride)
    failures.push(
      `lint-exemptions.json lists ${exemption.rule} for ${exemption.files.join(", ")}, but .oxlintrc.json has no matching override`,
    );

  for (const filePattern of exemption.files) {
    const pattern = filePattern.replace(/^\.\//, "");

    if (!trackedFiles.some((filePath) => matchesGlob(filePath, pattern)))
      failures.push(`lint-exemptions.json names ${filePattern}, which matches no tracked file`);
  }
}

const ignoredTrackedFiles = execFileSync(
  "git",
  ["ls-files", "--cached", "--ignored", "--exclude-standard"],
  { cwd: root, encoding: "utf8" },
)
  .split("\n")
  .filter((filePath) => filePath !== "");

for (const filePath of ignoredTrackedFiles)
  failures.push(`${filePath} is tracked but matches .gitignore, so lint and format skip it`);

for (const filePath of trackedFiles) {
  if (extraLintConfigPattern.test(filePath) && filePath !== ".oxlintrc.json")
    failures.push(`${filePath} changes what oxlint or oxfmt checks outside gates.json`);

  if (
    lintedSourcePattern.test(filePath) &&
    !filePath.startsWith("tools/oxlint/anti-slop/") &&
    inlineDisablePattern.test(readText(filePath))
  )
    failures.push(`${filePath} disables lint inline; use lint-exemptions.json`);

  if (foreignLockfiles.includes(basename(filePath)))
    failures.push(`${filePath} is tracked; traviz installs with bun only`);
}

const fallowConfig = z
  .object({ health: z.object({ maxCrap: z.number() }) })
  .parse(readConfig(".fallowrc.json"));

if (fallowConfig.health.maxCrap > maxCrapCeiling)
  failures.push(`.fallowrc.json must set health.maxCrap to ${maxCrapCeiling} or lower`);

const doctorConfig = z
  .object({ blocking: z.string().optional() })
  .parse(readConfig("doctor.config.json"));

if (doctorConfig.blocking !== "warning")
  failures.push('doctor.config.json must set blocking to "warning"');

for (const failure of failures) console.error(failure);

console.log(`check:gates ${failures.length} loosened`);

if (failures.length > 0) process.exit(1);
