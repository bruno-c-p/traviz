import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs, parseEnv } from "node:util";
import { runClerkDev, seededUserEmail, seedUser } from "@/shared/testing/clerk-dev";

const { values: options } = parseArgs({ options: { root: { type: "string" } } });
const root = resolve(options.root ?? join(import.meta.dirname, ".."));
const dataDirectory = join(root, ".data");
const envLocalPath = join(root, ".env.local");
const processEnvironmentSource = "the process environment (shell or .env)";

const clerkDevelopmentKeyPrefixes = [
  ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_"],
  ["CLERK_SECRET_KEY", "sk_test_"],
] as const;

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

function refuseRemoteDatabase(existing: Map<string, string>): void {
  const sources = [
    [".env.local", existing.get("TURSO_DATABASE_URL")],
    [processEnvironmentSource, process.env.TURSO_DATABASE_URL],
  ] as const;

  for (const [source, databaseUrl] of sources)
    if (databaseUrl !== undefined && !databaseUrl.startsWith("file:"))
      fail(
        `Refusing: TURSO_DATABASE_URL in ${source} is not a file: database. Setup never touches a remote database.`,
      );
}

function pullClerkKeys(existing: Map<string, string>, additions: Map<string, string>): void {
  if (clerkDevelopmentKeyPrefixes.every(([name]) => existing.has(name))) return;

  const pulled = pullEnvFile("clerk-dev.env", (filePath) => {
    runClerkDev(["env", "pull", "--file", filePath]);
  });

  for (const [name] of clerkDevelopmentKeyPrefixes) {
    const pulledValue = pulled.get(name);

    if (!existing.has(name) && pulledValue !== undefined) additions.set(name, pulledValue);
  }
}

function refuseNonDevelopmentClerkKeys(
  source: string,
  lookup: (name: string) => string | undefined,
): void {
  for (const [name, prefix] of clerkDevelopmentKeyPrefixes) {
    const value = lookup(name);

    if (value !== undefined && !value.startsWith(prefix))
      fail(
        `Refusing: ${name} in ${source} is not a Clerk development key (${prefix}). Setup only writes development keys.`,
      );
  }
}

function requireClerkKeys(existing: Map<string, string>, additions: Map<string, string>): void {
  for (const [name] of clerkDevelopmentKeyPrefixes)
    if (!existing.has(name) && !additions.has(name)) fail(`clerk env pull returned no ${name}.`);
}

function pullMapboxToken(): string | undefined {
  try {
    return pullEnvFile("vercel-development.env", (filePath) => {
      execFileSync(
        "vercel",
        ["env", "pull", filePath, "--environment", "development", "--project", "traviz", "--yes"],
        { stdio: ["ignore", "ignore", "inherit"] },
      );
    }).get("NEXT_PUBLIC_MAPBOX_TOKEN");
  } catch (cause: unknown) {
    console.log(
      `vercel env pull failed: ${cause instanceof Error ? cause.message : String(cause)}`,
    );

    return undefined;
  }
}

function addMapboxToken(existing: Map<string, string>, additions: Map<string, string>): void {
  if (existing.has("NEXT_PUBLIC_MAPBOX_TOKEN")) return;

  const mapboxToken = pullMapboxToken();

  if (mapboxToken) additions.set("NEXT_PUBLIC_MAPBOX_TOKEN", mapboxToken);
  else
    console.log(
      "No Mapbox token. The globe shows a flat placeholder; the list, stats and sign-in still work.",
    );
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

  refuseRemoteDatabase(existing);
  refuseNonDevelopmentClerkKeys(".env.local", (name) => existing.get(name));
  refuseNonDevelopmentClerkKeys(processEnvironmentSource, (name) => process.env[name]);
  mkdirSync(dataDirectory, { recursive: true });
  pullClerkKeys(existing, additions);
  refuseNonDevelopmentClerkKeys("the clerk env pull output", (name) => additions.get(name));
  requireClerkKeys(existing, additions);
  addMapboxToken(existing, additions);

  if (!existing.has("TURSO_DATABASE_URL")) additions.set("TURSO_DATABASE_URL", "file:.data/dev.db");

  appendToEnvLocal(additions);
  runMigration();
  seedUser();

  console.log(`Dev test user ${seededUserEmail} is ready.`);
  console.log("Next: run bun run dev, then bun run sign-in-token for a signed-in session.");
}

main();
