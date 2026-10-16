import { afterAll, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const repoRoot = join(import.meta.dir, "..", "..", "..");
const setupScript = join(repoRoot, "scripts", "setup.ts");
const signInTokenScript = join(repoRoot, "scripts", "sign-in-token.ts");
const fixtureRoots: string[] = [];

const fakeClerk = `#!/bin/sh
printf '%s\\n' "clerk $*" >> "$FAKE_LOG"
printf 'clerk-env %s %s %s\\n' "\${CLERK_SECRET_KEY:-none}" "\${CLERK_PUBLISHABLE_KEY:-none}" "\${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:-none}" >> "$FAKE_LOG"
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
  /sign_in_tokens) printf '{"token":"token_fake"}' ;;
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
  environment?: Record<string, string>;
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

function runScript(
  script: string,
  behaviour: FakeBehaviour,
  fixtureRoot = createFixture(behaviour.envLocal),
) {
  const logPath = join(fixtureRoot, "calls.log");

  rmSync(logPath, { force: true });

  const result = spawnSync(process.execPath, [script, "--root", fixtureRoot], {
    cwd: fixtureRoot,
    encoding: "utf8",
    env: {
      NODE_ENV: "development",
      PATH: `${join(fixtureRoot, "bin")}:${process.env.PATH ?? ""}`,
      HOME: process.env.HOME,
      FAKE_LOG: logPath,
      FAKE_PUBLISHABLE_KEY: behaviour.publishableKey ?? "pk_test_pulled",
      FAKE_SECRET_KEY: behaviour.secretKey ?? "sk_test_pulled",
      FAKE_USERS: behaviour.users ?? "[]",
      FAKE_VERCEL_FAILS: behaviour.vercelFails ? "1" : "",
      ...behaviour.environment,
    },
  });

  const envLocalPath = join(fixtureRoot, ".env.local");
  const logLines = existsSync(logPath) ? readFileSync(logPath, "utf8").trim().split("\n") : [];

  return {
    fixtureRoot,
    exitCode: result.status,
    stdout: result.stdout,
    output: result.stdout + result.stderr,
    calls: logLines.filter((line) => !line.startsWith("clerk-env ")),
    clerkKeysSeen: logLines.filter((line) => line.startsWith("clerk-env ")),
    envLocal: existsSync(envLocalPath) ? readFileSync(envLocalPath, "utf8") : null,
    migrated: existsSync(join(fixtureRoot, "migrated")),
  };
}

function runSetup(behaviour: FakeBehaviour, fixtureRoot?: string) {
  return runScript(setupScript, behaviour, fixtureRoot);
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
  expect(run.output).toContain(
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY in the clerk env pull output is not a Clerk development key",
  );
  expect(run.output).not.toContain("pk_live_pulled");
  expect(run.envLocal).toBeNull();
  expect(run.migrated).toBe(false);
});

test("refuses a pulled live secret key and writes nothing", () => {
  const run = runSetup({ secretKey: "sk_live_pulled" });

  expect(run.exitCode).not.toBe(0);
  expect(run.output).toContain(
    "CLERK_SECRET_KEY in the clerk env pull output is not a Clerk development key",
  );
  expect(run.envLocal).toBeNull();
  expect(run.migrated).toBe(false);
});

test("refuses a live secret key already in .env.local", () => {
  const envLocal = completeEnvLocal.replace("sk_test_existing", "sk_live_existing");
  const run = runSetup({ envLocal });

  expect(run.exitCode).not.toBe(0);
  expect(run.output).toContain("CLERK_SECRET_KEY in .env.local is not a Clerk development key");
  expect(run.envLocal).toBe(envLocal);
  expect(run.calls).toEqual([]);
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

test("refuses a remote database in the process environment", () => {
  const run = runSetup({ environment: { TURSO_DATABASE_URL: "libsql://x.turso.io" } });

  expect(run.exitCode).not.toBe(0);
  expect(run.output).toContain(
    "TURSO_DATABASE_URL in the process environment (shell or .env) is not a file: database",
  );
  expect(run.envLocal).toBeNull();
  expect(run.calls).toEqual([]);
  expect(run.migrated).toBe(false);
});

test("continues without a Mapbox token when vercel fails", () => {
  const run = runSetup({ vercelFails: true });

  expect(run.exitCode).toBe(0);
  expect(run.envLocal).not.toContain("NEXT_PUBLIC_MAPBOX_TOKEN");
  expect(run.output).toContain("vercel env pull failed: Command failed: vercel env pull");
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

for (const [name, value] of [
  ["CLERK_SECRET_KEY", "sk_live_shell"],
  ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_live_shell"],
] as const)
  test(`refuses a live ${name} in the process environment before any Clerk call`, () => {
    const run = runSetup({ environment: { [name]: value } });

    expect(run.exitCode).not.toBe(0);
    expect(run.output).toContain(
      `${name} in the process environment (shell or .env) is not a Clerk development key`,
    );
    expect(run.output).not.toContain(value);
    expect(run.envLocal).toBeNull();
    expect(run.calls).toEqual([]);
  });

test("clerk never receives a Clerk key from the process environment or .env.local", () => {
  const run = runSetup({
    envLocal: completeEnvLocal,
    users: '[{"id":"user_existing"}]',
    environment: { CLERK_SECRET_KEY: "sk_test_shell", CLERK_PUBLISHABLE_KEY: "pk_test_shell" },
  });

  expect(run.exitCode).toBe(0);
  expect(new Set(run.clerkKeysSeen)).toEqual(new Set(["clerk-env none none none"]));
});

test("creates .env.local readable only by its owner", () => {
  const run = runSetup({});

  expect(statSync(join(run.fixtureRoot, ".env.local")).mode & 0o777).toBe(0o600);
});

test("a second run leaves .env.local byte-identical and pulls nothing", () => {
  const firstRun = runSetup({});
  const secondRun = runSetup({ users: '[{"id":"user_created"}]' }, firstRun.fixtureRoot);

  expect(secondRun.exitCode).toBe(0);
  expect(secondRun.envLocal).toBe(firstRun.envLocal);
  expect(secondRun.calls.some((call) => call.includes("env pull"))).toBe(false);
});

test("appends the pulled secret key on a new line after a publishable key with no newline", () => {
  const run = runSetup({ envLocal: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_x" });

  expect(run.exitCode).toBe(0);
  expect(run.envLocal).toBe(
    [
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_x",
      "CLERK_SECRET_KEY=sk_test_pulled",
      "NEXT_PUBLIC_MAPBOX_TOKEN=pk.fake-mapbox",
      "TURSO_DATABASE_URL=file:.data/dev.db",
      "",
    ].join("\n"),
  );
});

test("sign-in-token prints only a ten-minute token for the dev test user", () => {
  const run = runScript(signInTokenScript, {
    envLocal: completeEnvLocal,
    users: '[{"id":"user_existing"}]',
  });

  expect(run.exitCode).toBe(0);
  expect(run.stdout).toBe("token_fake\n");
  expect(run.calls.length).toBe(2);
  expect(run.calls.every((call) => call.endsWith("--instance dev"))).toBe(true);
  expect(new Set(run.clerkKeysSeen)).toEqual(new Set(["clerk-env none none none"]));

  const tokenCall = run.calls.find((call) =>
    call.startsWith("clerk api /sign_in_tokens --yes -d "),
  );

  expect(tokenCall).toContain('"user_id":"user_existing"');
  expect(tokenCall).toContain('"expires_in_seconds":600');
});

test("sign-in-token exits 1 and points to setup when the dev test user does not exist", () => {
  const run = runScript(signInTokenScript, { envLocal: completeEnvLocal });

  expect(run.exitCode).toBe(1);
  expect(run.stdout).toBe("");
  expect(run.output).toContain("Run bun run setup first");
  expect(run.calls.some((call) => call.includes("/sign_in_tokens"))).toBe(false);
});

test("reads single-quoted, exported and commented values in .env.local", () => {
  const envLocal = [
    "export NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_existing # development",
    "CLERK_SECRET_KEY='sk_test_existing'",
    "NEXT_PUBLIC_MAPBOX_TOKEN=pk.existing",
    "TURSO_DATABASE_URL='file:.data/dev.db'",
    "",
  ].join("\n");

  const run = runSetup({ envLocal, users: '[{"id":"user_existing"}]' });

  expect(run.exitCode).toBe(0);
  expect(run.envLocal).toBe(envLocal);
  expect(run.calls.some((call) => call.includes("env pull"))).toBe(false);
});
