import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, matchesGlob, resolve } from "node:path";
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
const oxlintConfigFilePattern = /(^|\/)(\.?oxlintrc(\.[a-z]+)?|oxlint\.config\.[cm]?[jt]s)$/;

const pinnedScripts = {
  lint: "oxlint --type-aware --deny-warnings",
  typecheck: "tsc --noEmit",
  test: "bun test",
  "test:rules":
    "node --import ./tools/oxlint/node-test-setup.ts --test 'tools/oxlint/**/*.test.ts'",
  fallow: "fallow",
  "react-doctor": "react-doctor",
  "check:gates": "bun scripts/check-gates.ts",
  "check:docs": "bun scripts/check-docs.ts",
  "check:bundle": "bun scripts/check-bundle.ts",
  check:
    "bun run check:gates && bun run format --check && bun run lint && bun run typecheck && bun run check:docs && bun run test && bun run test:rules && NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA= NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_Y2xlcmsuZXhhbXBsZS5jb20k NEXT_PUBLIC_MAPBOX_TOKEN=pk.check-bundle TURSO_DATABASE_URL=libsql://ci-placeholder.turso.io TURSO_AUTH_TOKEN=ci bun run build && bun run check:bundle",
};

const afterInstall = "${{ !cancelled() && steps.install.outcome == 'success' }}";

const pinnedCiSteps = [
  { run: "bun run check" },
  { run: "bun run fallow", if: afterInstall },
  { run: "bun run react-doctor --no-telemetry", if: afterInstall },
];

const pinnedFallowConfig = {
  $schema: "https://raw.githubusercontent.com/fallow-rs/fallow/main/schema.json",
  ignorePatterns: ["tools/**"],
  ignoreDependencies: ["@oxlint/plugins"],
};

const pinnedDoctorConfig = {
  adoptExistingLintConfig: false,
  blocking: "warning",
  ignore: { files: ["tools/**"] },
};

const pinnedOxlintPlugins = ["react", "typescript", "oxc"];
const pinnedOxlintIgnorePatterns = ["tools/oxlint/anti-slop/**"];

const pinnedTsconfigInclude = [
  "src",
  "scripts",
  "next-env.d.ts",
  ".next/types/**/*.ts",
  ".next/dev/types/**/*.ts",
];

const strictFamilyFlags = [
  "noImplicitAny",
  "noImplicitThis",
  "strictNullChecks",
  "strictFunctionTypes",
  "strictBindCallApply",
  "strictPropertyInitialization",
  "strictBuiltinIteratorReturn",
  "alwaysStrict",
  "useUnknownInCatchVariables",
];

const failures: string[] = [];

function readText(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

function readJsonc(relativePath: string) {
  return Bun.JSONC.parse(readText(relativePath));
}

function expectPinned<T>(label: string, actual: T, expected: NoInfer<T>) {
  if (!isDeepStrictEqual(actual, expected))
    failures.push(
      `${label} is ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}. A tightening also updates scripts/check-gates.ts`,
    );
}

const severitySchema = z.union([z.string(), z.number()]);
const ruleSettingSchema = z.union([severitySchema, z.tuple([severitySchema], z.unknown())]);
const rulesSchema = z.record(z.string(), ruleSettingSchema);

const oxlintConfigSchema = z.strictObject({
  $schema: z.string().optional(),
  plugins: z.array(z.string()),
  jsPlugins: z.array(z.object({ name: z.string(), specifier: z.string() })),
  categories: z.record(z.string(), severitySchema).default({}),
  rules: rulesSchema,
  overrides: z.array(z.strictObject({ files: z.array(z.string()), rules: rulesSchema })),
  ignorePatterns: z.array(z.string()),
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

const workflowFiles = trackedFiles.filter((filePath) => /^\.github\/.*\.ya?ml$/.test(filePath));

const workflowStepSchema = z.object({
  uses: z.string().optional(),
  run: z.string().optional(),
  if: z.string().optional(),
  with: z.record(z.string(), z.unknown()).optional(),
});

const workflowJobsSchema = z.object({
  jobs: z.record(z.string(), z.object({ steps: z.array(workflowStepSchema).optional() })),
});

const parsedWorkflows = workflowFiles.map((workflowFile) => {
  const workflow = Bun.YAML.parse(readText(workflowFile));

  return { workflowFile, workflow, jobs: workflowJobsSchema.safeParse(workflow).data?.jobs ?? {} };
});

for (const { workflowFile, workflow } of parsedWorkflows) {
  if (JSON.stringify(workflow).includes('"continue-on-error":'))
    failures.push(`${workflowFile} uses continue-on-error, so a failing step would not fail CI`);
}

const ciSteps =
  parsedWorkflows.find(({ workflowFile }) => workflowFile === ".github/workflows/ci.yml")?.jobs
    .check?.steps ?? [];

for (const pinnedStep of pinnedCiSteps) {
  const hasStep = ciSteps.some((step) => step.run === pinnedStep.run && step.if === pinnedStep.if);

  if (!hasStep)
    failures.push(
      `.github/workflows/ci.yml job check must run "${pinnedStep.run}"${pinnedStep.if ? ` with if: ${pinnedStep.if}` : " unconditionally"}`,
    );
}

const packageManifest = z
  .object({
    scripts: z.record(z.string(), z.string()),
    devEngines: z
      .object({ packageManager: z.object({ name: z.string(), version: z.string() }).optional() })
      .optional(),
  })
  .parse(JSON.parse(readText("package.json")));

for (const [scriptName, command] of Object.entries(pinnedScripts)) {
  expectPinned(`package.json script ${scriptName}`, packageManifest.scripts[scriptName], command);
}

const tsconfig = z
  .object({
    extends: z.unknown().optional(),
    compilerOptions: z.record(z.string(), z.unknown()),
    include: z.array(z.string()),
    exclude: z.array(z.string()).optional(),
  })
  .parse(readJsonc("tsconfig.json"));

if (tsconfig.compilerOptions.strict !== true)
  failures.push("tsconfig.json must set compilerOptions.strict to true");

for (const flag of strictFamilyFlags) {
  if (tsconfig.compilerOptions[flag] === false)
    failures.push(`tsconfig.json turns ${flag} off under strict`);
}

if (tsconfig.extends !== undefined) failures.push("tsconfig.json must not use extends");

expectPinned("tsconfig.json include", tsconfig.include, pinnedTsconfigInclude);

expectPinned("tsconfig.json exclude", tsconfig.exclude, ["node_modules"]);

for (const filePath of trackedFiles) {
  if (oxlintConfigFilePattern.test(filePath) && filePath !== ".oxlintrc.json")
    failures.push(`${filePath} is an extra oxlint config; keep every rule in .oxlintrc.json`);
}

const oxlintConfig = oxlintConfigSchema.safeParse(readJsonc(".oxlintrc.json"));

if (!oxlintConfig.success)
  failures.push(
    `.oxlintrc.json has a key or shape check:gates does not know, such as extends: ${oxlintConfig.error.message}`,
  );

const exemptions = exemptionsSchema.parse(JSON.parse(readText("lint-exemptions.json")));

if (oxlintConfig.success) {
  const { categories, rules, overrides, plugins, ignorePatterns } = oxlintConfig.data;

  expectPinned(".oxlintrc.json plugins", plugins, pinnedOxlintPlugins);
  expectPinned(".oxlintrc.json ignorePatterns", ignorePatterns, pinnedOxlintIgnorePatterns);

  if (categories.correctness !== "error")
    failures.push('.oxlintrc.json must set categories.correctness to "error"');

  for (const [category, severity] of Object.entries(categories)) {
    if (!errorSeverities.has(severity))
      failures.push(`.oxlintrc.json sets category ${category} to ${severity}`);
  }

  for (const [rule, setting] of Object.entries(rules)) {
    const severity = severityOf(setting);

    if (!errorSeverities.has(severity))
      failures.push(
        `.oxlintrc.json sets ${rule} to ${severity}; every configured rule must be error`,
      );
  }

  for (const override of overrides) {
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
    const hasOverride = overrides.some(
      (override) =>
        filesKey(override.files) === filesKey(exemption.files) &&
        disabledSeverities.has(severityOf(override.rules[exemption.rule] ?? "error")),
    );

    if (!hasOverride)
      failures.push(
        `lint-exemptions.json lists ${exemption.rule} for ${exemption.files.join(", ")}, but .oxlintrc.json has no matching override`,
      );
  }
}

for (const exemption of exemptions) {
  for (const filePattern of exemption.files) {
    const pattern = filePattern.replace(/^\.\//, "");

    if (!trackedFiles.some((filePath) => matchesGlob(filePath, pattern)))
      failures.push(`lint-exemptions.json names ${filePattern}, which matches no tracked file`);
  }
}

const {
  health: { maxCrap, ...otherHealthSettings },
  ...otherFallowSettings
} = z
  .object({ health: z.object({ maxCrap: z.number() }).catchall(z.unknown()) })
  .catchall(z.unknown())
  .parse(readJsonc(".fallowrc.json"));

if (maxCrap > maxCrapCeiling)
  failures.push(`.fallowrc.json must set health.maxCrap to ${maxCrapCeiling} or lower`);

expectPinned(".fallowrc.json health (besides maxCrap)", otherHealthSettings, {});

expectPinned(".fallowrc.json (besides health)", otherFallowSettings, pinnedFallowConfig);

expectPinned("doctor.config.json", readJsonc("doctor.config.json"), pinnedDoctorConfig);

for (const filePath of trackedFiles) {
  if (foreignLockfiles.includes(filePath.split("/").at(-1) ?? ""))
    failures.push(`${filePath} is tracked; traviz installs with bun only`);
}

const pinnedBun = packageManifest.devEngines?.packageManager;

const ciBunVersions = parsedWorkflows.flatMap(({ jobs }) =>
  Object.values(jobs).flatMap((job) =>
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
