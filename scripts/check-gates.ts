import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join, matchesGlob, resolve } from "node:path";
import { parseArgs } from "node:util";
import { z } from "zod";

const { values: options } = parseArgs({ options: { root: { type: "string" } } });
const repoRoot = join(import.meta.dirname, "..");
const root = resolve(options.root ?? repoRoot);
const oxlintBinary = join(repoRoot, "node_modules", ".bin", "oxlint");
const maxCrapCeiling = 73;
const foreignLockfiles = ["pnpm-lock.yaml", "package-lock.json", "yarn.lock"];
const allowedSeverities = new Set(["error", "deny", 2]);
const disabledSeverities = new Set(["off", "allow", 0]);

const failures: string[] = [];

function readText(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

function readJsonc(relativePath: string) {
  return Bun.JSONC.parse(readText(relativePath));
}

const severitySchema = z.union([z.string(), z.number()]);
const ruleSettingSchema = z.union([severitySchema, z.tuple([severitySchema], z.unknown())]);
const rulesSchema = z.record(z.string(), ruleSettingSchema);

const oxlintConfigSchema = z.object({
  categories: z.record(z.string(), severitySchema).optional(),
  rules: rulesSchema.optional(),
  overrides: z.array(z.object({ files: z.array(z.string()), rules: rulesSchema })).optional(),
});

const exemptionsSchema = z.array(
  z.strictObject({
    files: z.array(z.string()).min(1),
    rule: z.string(),
    reason: z.string().min(1),
  }),
);

function severityOf(setting: z.infer<typeof ruleSettingSchema>) {
  return Array.isArray(setting) ? setting[0] : setting;
}

function filesKey(files: string[]): string {
  return JSON.stringify(files);
}

const trackedFiles = execFileSync("git", ["ls-files", "--cached"], { cwd: root, encoding: "utf8" })
  .split("\n")
  .filter((filePath) => filePath !== "");

const workflowFiles = readdirSync(join(root, ".github", "workflows"))
  .filter((fileName) => /\.ya?ml$/.test(fileName))
  .sort()
  .map((fileName) => `.github/workflows/${fileName}`);

for (const workflowFile of workflowFiles) {
  if (readText(workflowFile).includes("continue-on-error"))
    failures.push(`${workflowFile} uses continue-on-error, so a failing step would not fail CI`);
}

const tsconfig = z
  .object({ compilerOptions: z.object({ strict: z.boolean().optional() }) })
  .parse(readJsonc("tsconfig.json"));

if (tsconfig.compilerOptions.strict !== true)
  failures.push("tsconfig.json must set compilerOptions.strict to true");

const oxlintConfig = oxlintConfigSchema.parse(readJsonc(".oxlintrc.json"));
const exemptions = exemptionsSchema.parse(JSON.parse(readText("lint-exemptions.json")));

if (oxlintConfig.categories?.correctness !== "error")
  failures.push(
    '.oxlintrc.json must set categories.correctness to "error", because oxlint defaults it to warn',
  );

for (const [category, severity] of Object.entries(oxlintConfig.categories ?? {})) {
  if (!allowedSeverities.has(severity))
    failures.push(`.oxlintrc.json sets category ${category} to ${severity}`);
}

for (const [rule, setting] of Object.entries(oxlintConfig.rules ?? {})) {
  const severity = severityOf(setting);

  if (!allowedSeverities.has(severity))
    failures.push(
      `.oxlintrc.json sets ${rule} to ${severity}; every configured rule must be error`,
    );
}

for (const override of oxlintConfig.overrides ?? []) {
  for (const [rule, setting] of Object.entries(override.rules)) {
    const severity = severityOf(setting);

    const isExempt = exemptions.some(
      (exemption) =>
        exemption.rule === rule && filesKey(exemption.files) === filesKey(override.files),
    );

    if (allowedSeverities.has(severity) || (disabledSeverities.has(severity) && isExempt)) continue;

    failures.push(
      `.oxlintrc.json sets ${rule} to ${severity} for ${override.files.join(", ")} without an entry in lint-exemptions.json`,
    );
  }
}

for (const exemption of exemptions) {
  const hasOverride = (oxlintConfig.overrides ?? []).some(
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

const printedConfig = z
  .object({ rules: rulesSchema, overrides: z.array(z.object({ rules: rulesSchema })).default([]) })
  .parse(
    JSON.parse(
      execFileSync(oxlintBinary, ["--type-aware", "--print-config"], {
        cwd: root,
        encoding: "utf8",
      }),
    ),
  );

for (const rules of [printedConfig.rules, ...printedConfig.overrides.map((item) => item.rules)]) {
  for (const [rule, setting] of Object.entries(rules)) {
    if (severityOf(setting) === "warn")
      failures.push(`oxlint resolves ${rule} to warn; lint would pass with it`);
  }
}

const fallowConfig = z
  .object({ health: z.object({ maxCrap: z.number() }) })
  .safeParse(readJsonc(".fallowrc.json"));

if (!fallowConfig.success || fallowConfig.data.health.maxCrap > maxCrapCeiling)
  failures.push(`.fallowrc.json must set health.maxCrap to ${maxCrapCeiling} or lower`);

const doctorConfig = z
  .object({ blocking: z.string().optional() })
  .parse(readJsonc("doctor.config.json"));

if (doctorConfig.blocking !== "warning")
  failures.push('doctor.config.json must set blocking to "warning"');

for (const filePath of trackedFiles) {
  if (foreignLockfiles.some((lockfile) => filePath.split("/").at(-1) === lockfile))
    failures.push(`${filePath} is tracked; traviz installs with bun only`);
}

const packageManifest = z
  .object({
    devEngines: z
      .object({ packageManager: z.object({ name: z.string(), version: z.string() }).optional() })
      .optional(),
  })
  .parse(JSON.parse(readText("package.json")));

const pinnedBun = packageManifest.devEngines?.packageManager;

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

const ciBunVersions = workflowFiles.flatMap((workflowFile) =>
  Object.values(workflowStepsSchema.parse(Bun.YAML.parse(readText(workflowFile))).jobs).flatMap(
    (job) =>
      (job.steps ?? []).flatMap((step) =>
        step.uses?.startsWith("oven-sh/setup-bun") ? [String(step.with?.["bun-version"])] : [],
      ),
  ),
);

if (pinnedBun?.name !== "bun")
  failures.push("package.json must pin bun in devEngines.packageManager");

if (ciBunVersions.length === 0)
  failures.push("no workflow step sets up bun with oven-sh/setup-bun");

for (const ciBunVersion of ciBunVersions) {
  if (ciBunVersion !== pinnedBun?.version)
    failures.push(
      `CI sets bun-version ${ciBunVersion}, but devEngines.packageManager.version is ${pinnedBun?.version ?? "missing"}`,
    );
}

for (const failure of failures) console.error(failure);

console.log(`check:gates ${failures.length} loosened`);

if (failures.length > 0) process.exit(1);
