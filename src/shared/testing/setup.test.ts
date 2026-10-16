import { afterAll, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const repoRoot = join(import.meta.dir, "..", "..", "..");
const setupScript = join(repoRoot, "scripts", "setup.ts");
const fixtureRoots: string[] = [];

const fakeClerk = `#!/bin/sh
printf '%s\\n' "clerk $*" >> "$FAKE_LOG"
if [ "$1 $2" = "env pull" ]; then
  while [ $# -gt 0 ]; do
    if [ "$1" = "--file" ]; then pulled_file="$2"; fi
    shift
  done
  printf 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=%s\\nCLERK_SECRET_KEY=%s\\n' "$FAKE_PUBLISHABLE_KEY" "$FAKE_SECRET_KEY" > "$pulled_file"
  exit 0
fi
case "$2" in
  /users\\?*) printf '%s' "$FAKE_USERS" ;;
  /users) printf '{"id":"user_created"}' ;;
esac
`;

const fakeVercel = `#!/bin/sh
printf '%s\\n' "vercel $*" >> "$FAKE_LOG"
if [ -n "$FAKE_VERCEL_FAILS" ]; then exit 1; fi
printf 'NEXT_PUBLIC_MAPBOX_TOKEN="pk.fake-mapbox"\\nTURSO_DATABASE_URL="libsql://remote.turso.io"\\nTURSO_AUTH_TOKEN="remote-token"\\nCLERK_SECRET_KEY="sk_live_remote"\\n' > "$3"
`;

const completeEnvLocal = [
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_existing",
  "CLERK_SECRET_KEY=sk_test_existing",
  "NEXT_PUBLIC_MAPBOX_TOKEN=pk.existing",
  "TURSO_DATABASE_URL=file:.data/dev.db",
  "",
].join("\n");

type FakeBehaviour = {
  publishableKey?: string;
  secretKey?: string;
  users?: string;
  vercelFails?: boolean;
  envLocal?: string;
};

function createFixture(envLocal: string | undefined): string {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "setup-"));
  fixtureRoots.push(fixtureRoot);

  mkdirSync(join(fixtureRoot, "bin"));
  writeFileSync(join(fixtureRoot, "bin", "clerk"), fakeClerk);
  writeFileSync(join(fixtureRoot, "bin", "vercel"), fakeVercel);
  chmodSync(join(fixtureRoot, "bin", "clerk"), 0o755);
  chmodSync(join(fixtureRoot, "bin", "vercel"), 0o755);
  writeFileSync(
    join(fixtureRoot, "package.json"),
    JSON.stringify({ scripts: { "db:migrate": "touch migrated" } }),
  );

  if (envLocal !== undefined) writeFileSync(join(fixtureRoot, ".env.local"), envLocal);

  return fixtureRoot;
}

function runSetup(behaviour: FakeBehaviour) {
  const fixtureRoot = createFixture(behaviour.envLocal);
  const logPath = join(fixtureRoot, "calls.log");

  const result = spawnSync(process.execPath, [setupScript, "--root", fixtureRoot], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${join(fixtureRoot, "bin")}:${process.env.PATH ?? ""}`,
      FAKE_LOG: logPath,
      FAKE_PUBLISHABLE_KEY: behaviour.publishableKey ?? "pk_test_pulled",
      FAKE_SECRET_KEY: behaviour.secretKey ?? "sk_test_pulled",
      FAKE_USERS: behaviour.users ?? "[]",
      FAKE_VERCEL_FAILS: behaviour.vercelFails ? "1" : "",
    },
  });

  const envLocalPath = join(fixtureRoot, ".env.local");

  return {
    fixtureRoot,
    exitCode: result.status,
    output: result.stdout + result.stderr,
    calls: existsSync(logPath) ? readFileSync(logPath, "utf8").trim().split("\n") : [],
    envLocal: existsSync(envLocalPath) ? readFileSync(envLocalPath, "utf8") : null,
    migrated: existsSync(join(fixtureRoot, "migrated")),
  };
}

afterAll(() => {
  for (const fixtureRoot of fixtureRoots) rmSync(fixtureRoot, { recursive: true, force: true });
});

test("a fresh root gets development keys, the Mapbox token and a local database", () => {
  const run = runSetup({});

  expect(run.exitCode).toBe(0);
  expect(run.envLocal).toBe(
    [
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_pulled",
      "CLERK_SECRET_KEY=sk_test_pulled",
      "NEXT_PUBLIC_MAPBOX_TOKEN=pk.fake-mapbox",
      "TURSO_DATABASE_URL=file:.data/dev.db",
      "",
    ].join("\n"),
  );
  expect(run.envLocal).not.toContain("TURSO_AUTH_TOKEN");
  expect(run.envLocal).not.toContain("libsql:");
  expect(existsSync(join(run.fixtureRoot, ".data"))).toBe(true);
  expect(existsSync(join(run.fixtureRoot, ".data", "clerk-dev.env"))).toBe(false);
  expect(existsSync(join(run.fixtureRoot, ".data", "vercel-development.env"))).toBe(false);
  expect(run.migrated).toBe(true);
  expect(run.output).toContain("bun run sign-in-token");

  const clerkCalls = run.calls.filter((call) => call.startsWith("clerk "));

  expect(clerkCalls.length).toBe(3);
  expect(clerkCalls.every((call) => call.endsWith("--instance dev"))).toBe(true);
  expect(clerkCalls.some((call) => call.startsWith("clerk api /users --yes -d"))).toBe(true);
  expect(run.calls.some((call) => call.includes("--environment development"))).toBe(true);
});

test("refuses a pulled live publishable key and writes nothing", () => {
  const run = runSetup({ publishableKey: "pk_live_pulled" });

  expect(run.exitCode).not.toBe(0);
  expect(run.output).toContain("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is not a Clerk development key");
  expect(run.output).not.toContain("pk_live_pulled");
  expect(run.envLocal).toBeNull();
  expect(run.migrated).toBe(false);
});

test("refuses a pulled live secret key and writes nothing", () => {
  const run = runSetup({ secretKey: "sk_live_pulled" });

  expect(run.exitCode).not.toBe(0);
  expect(run.output).toContain("CLERK_SECRET_KEY is not a Clerk development key");
  expect(run.envLocal).toBeNull();
  expect(run.migrated).toBe(false);
});

test("refuses a live secret key already in .env.local", () => {
  const envLocal = completeEnvLocal.replace("sk_test_existing", "sk_live_existing");
  const run = runSetup({ envLocal });

  expect(run.exitCode).not.toBe(0);
  expect(run.output).toContain("CLERK_SECRET_KEY is not a Clerk development key");
  expect(run.envLocal).toBe(envLocal);
  expect(run.migrated).toBe(false);
});

test("refuses a remote database in .env.local", () => {
  const envLocal = "TURSO_DATABASE_URL=libsql://x.turso.io\n";
  const run = runSetup({ envLocal });

  expect(run.exitCode).not.toBe(0);
  expect(run.output).toContain("TURSO_DATABASE_URL in .env.local is not a file: database");
  expect(run.envLocal).toBe(envLocal);
  expect(run.calls).toEqual([]);
  expect(run.migrated).toBe(false);
});

test("continues without a Mapbox token when vercel fails", () => {
  const run = runSetup({ vercelFails: true });

  expect(run.exitCode).toBe(0);
  expect(run.envLocal).not.toContain("NEXT_PUBLIC_MAPBOX_TOKEN");
  expect(run.output).toContain("No Mapbox token. The globe shows a flat placeholder");
  expect(run.migrated).toBe(true);
});

test("a complete .env.local pulls nothing and stays unchanged", () => {
  const run = runSetup({ envLocal: completeEnvLocal, users: '[{"id":"user_existing"}]' });

  expect(run.exitCode).toBe(0);
  expect(run.envLocal).toBe(completeEnvLocal);
  expect(run.calls.some((call) => call.includes("env pull"))).toBe(false);
  expect(run.migrated).toBe(true);
});

test("an existing dev test user is not created again", () => {
  const run = runSetup({ users: '[{"id":"user_existing"}]' });

  expect(run.exitCode).toBe(0);
  expect(run.calls.some((call) => call.startsWith("clerk api /users --yes"))).toBe(false);
});
