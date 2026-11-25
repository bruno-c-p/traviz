import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { parseArgs, parseEnv } from "node:util";
import {
  exitOnClerkCliError,
  legacyPublishableKeyVariable,
  publishableKeyVariable,
  runClerkDev,
  secretKeyVariable,
  seededUserEmail,
  seedUser,
} from "@/shared/testing/clerk-dev";

const { values: options } = parseArgs({ options: { root: { type: "string" } } });
const root = resolve(options.root ?? join(import.meta.dirname, ".."));
const dataDirectory = join(root, ".data");
const envLocalPath = join(root, ".env.local");
const processEnvironmentSource = "the process environment (shell or .env)";

const clerkKeyVariables = [publishableKeyVariable, secretKeyVariable] as const;
const pulledPublishableKeyName = /(?:^|_)CLERK_PUBLISHABLE_KEY$/;

const requiredPrefixes = new Map([
  [publishableKeyVariable, { prefix: "pk_test_", kind: "a Clerk development key" }],
  [legacyPublishableKeyVariable, { prefix: "pk_test_", kind: "a Clerk development key" }],
  [secretKeyVariable, { prefix: "sk_test_", kind: "a Clerk development key" }],
]);

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function readEnvFile(filePath: string): Map<string, string> {
  if (!existsSync(filePath)) return new Map();

  return new Map(
    Object.entries(parseEnv(readFileSync(filePath, "utf8"))).flatMap(
      ([name, value]): [string, string][] => (value === undefined ? [] : [[name, value]]),
    ),
  );
}

function pullEnvFile(fileName: string, pull: (filePath: string) => void): Map<string, string> {
  const filePath = join(dataDirectory, fileName);

  try {
    pull(filePath);

    return readEnvFile(filePath);
  } finally {
    rmSync(filePath, { force: true });
  }
}

function isInsideDataDirectory(databaseUrl: string): boolean {
  const databasePath = databaseUrl.slice("file:".length).replace(/^\/\/(?=\/)/, "");

  return resolve(root, databasePath).startsWith(dataDirectory + sep);
}

function refuseForeignDatabase(existing: Map<string, string>): void {
  const sources = [
    [".env.local", existing.get("TURSO_DATABASE_URL")],
    [processEnvironmentSource, process.env.TURSO_DATABASE_URL],
  ] as const;

  for (const [source, databaseUrl] of sources) {
    if (databaseUrl === undefined) continue;

    if (!databaseUrl.startsWith("file:"))
      fail(
        `Refusing: TURSO_DATABASE_URL in ${source} is not a file: database. Setup never touches a remote database.`,
      );

    if (!isInsideDataDirectory(databaseUrl))
      fail(
        `Refusing: TURSO_DATABASE_URL in ${source} must be a file inside this worktree's .data/. Setup never touches another worktree's database.`,
      );
  }
}

function pulledKey(pulled: Map<string, string>, name: string): string | undefined {
  if (name !== publishableKeyVariable) return pulled.get(name);

  return [...pulled].find(([pulledName]) => pulledPublishableKeyName.test(pulledName))?.[1];
}

function pullClerkKeys(existing: Map<string, string>, additions: Map<string, string>): void {
  const legacyPublishableKey = existing.get(legacyPublishableKeyVariable);

  if (!existing.has(publishableKeyVariable) && legacyPublishableKey !== undefined) {
    additions.set(publishableKeyVariable, legacyPublishableKey);
  }

  if (clerkKeyVariables.every((name) => existing.has(name) || additions.has(name))) return;

  const pulled = pullEnvFile("clerk-dev.env", (filePath) => {
    runClerkDev(["env", "pull", "--file", filePath]);
  });

  for (const name of clerkKeyVariables) {
    const pulledValue = pulledKey(pulled, name);

    if (!existing.has(name) && !additions.has(name) && pulledValue !== undefined) {
      additions.set(name, pulledValue);
    }
  }
}

function exposeSecretKey(existing: Map<string, string>, additions: Map<string, string>): void {
  const secretKey = existing.get(secretKeyVariable) ?? additions.get(secretKeyVariable);

  if (secretKey !== undefined) process.env[secretKeyVariable] = secretKey;
}

function refuseWrongPrefixes(source: string, lookup: (name: string) => string | undefined): void {
  for (const [name, { prefix, kind }] of requiredPrefixes) {
    const value = lookup(name);

    if (value !== undefined && !value.startsWith(prefix))
      fail(
        `Refusing: ${name} in ${source} is not ${kind} (${prefix}). Setup only writes development keys.`,
      );
  }
}

function requireClerkKeys(existing: Map<string, string>, additions: Map<string, string>): void {
  for (const name of clerkKeyVariables)
    if (!existing.has(name) && !additions.has(name)) fail(`clerk env pull returned no ${name}.`);
}

function appendToEnvLocal(additions: Map<string, string>): void {
  if (additions.size === 0) return;

  const current = existsSync(envLocalPath) ? readFileSync(envLocalPath, "utf8") : "";
  const separator = current === "" || current.endsWith("\n") ? "" : "\n";
  const lines = [...additions].map(([name, value]) => `${name}=${value}\n`);

  appendFileSync(envLocalPath, separator + lines.join(""), { mode: 0o600 });
}

function runMigration(): void {
  const migration = spawnSync(process.execPath, ["run", "db:migrate"], {
    cwd: root,
    stdio: "inherit",
  });

  if (migration.status !== 0) fail("bun run db:migrate failed.");
}

function main(): void {
  const existing = readEnvFile(envLocalPath);
  const additions = new Map<string, string>();

  refuseForeignDatabase(existing);
  refuseWrongPrefixes(".env.local", (name) => existing.get(name));
  refuseWrongPrefixes(processEnvironmentSource, (name) => process.env[name]);
  mkdirSync(dataDirectory, { recursive: true });
  pullClerkKeys(existing, additions);
  refuseWrongPrefixes("the clerk env pull output", (name) => additions.get(name));
  requireClerkKeys(existing, additions);

  if (!existing.has("TURSO_DATABASE_URL")) additions.set("TURSO_DATABASE_URL", "file:.data/dev.db");

  appendToEnvLocal(additions);
  runMigration();
  exposeSecretKey(existing, additions);
  seedUser();

  console.log(`Dev test user ${seededUserEmail} is ready.`);
  console.log("Next: run bun run dev, then bun run sign-in-token for a signed-in session.");
}

exitOnClerkCliError(main);
