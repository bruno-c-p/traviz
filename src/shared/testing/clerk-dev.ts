import { execFileSync, spawnSync } from "node:child_process";
import { join } from "node:path";
import { z } from "zod";

export const seededUserEmail = "agent+clerk_test@example.com";

export const publishableKeyVariable = "PUBLIC_CLERK_PUBLISHABLE_KEY";

export const legacyPublishableKeyVariable = "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY";

export const secretKeyVariable = "CLERK_SECRET_KEY";

const developmentSecretPrefix = "sk_test_";
const apiUrlVariable = "TRAVIZ_CLERK_API_URL";
const apiCallScript = join(import.meta.dirname, "clerk-api-call.ts");
const loopbackApiUrl = /^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/;

const userSchema = z.object({ id: z.string() });
const signInTokenSchema = z.object({ token: z.string() });

type ApiCall = { readonly method: "GET" | "POST"; readonly path: string; readonly body?: string };

class ClerkCliError extends Error {}

export function exitOnClerkCliError(run: () => void): void {
  try {
    run();
  } catch (cause: unknown) {
    if (!(cause instanceof ClerkCliError)) throw cause;

    console.error(cause.message);
    process.exit(1);
  }
}

function isClerkVariable(name: string): boolean {
  return name.startsWith("CLERK_") || name.endsWith("_CLERK_PUBLISHABLE_KEY");
}

function environmentWithoutClerk(): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      ([name]) => !isClerkVariable(name) && name !== apiUrlVariable,
    ),
  );
}

function isMissingCommand(cause: unknown): boolean {
  return cause instanceof Error && "code" in cause && cause.code === "ENOENT";
}

function cliFailure(cause: unknown): ClerkCliError {
  return new ClerkCliError(
    `clerk CLI missing or not logged in: install it and run clerk auth login, then rerun bun run setup, or put development ${publishableKeyVariable} and ${secretKeyVariable} values in .env.local (${cause instanceof Error ? cause.message : String(cause)})`,
  );
}

function runClerkCli(args: string[]): string {
  return execFileSync("clerk", [...args, "--instance", "dev"], {
    encoding: "utf8",
    env: environmentWithoutClerk(),
    stdio: ["ignore", "pipe", "inherit"],
  });
}

export function runClerkDev(args: string[]): string {
  try {
    return runClerkCli(args);
  } catch (cause: unknown) {
    throw cliFailure(cause);
  }
}

function apiUrlOverride(): string | undefined {
  const apiUrl = process.env[apiUrlVariable];

  if (apiUrl === undefined || apiUrl === "") return undefined;

  if (!loopbackApiUrl.test(apiUrl)) {
    throw new ClerkCliError(
      `Refusing: ${apiUrlVariable} may only name a server on this machine, such as http://127.0.0.1:4010.`,
    );
  }

  return apiUrl;
}

function callBackendApi(secretKey: string, { method, path, body }: ApiCall): string {
  if (!secretKey.startsWith(developmentSecretPrefix)) {
    throw new ClerkCliError(
      `Refusing: ${secretKeyVariable} is not a Clerk development key (${developmentSecretPrefix}). The dev scripts never call a production instance.`,
    );
  }

  const apiUrl = apiUrlOverride();

  const environment: NodeJS.ProcessEnv = {
    ...environmentWithoutClerk(),
    [secretKeyVariable]: secretKey,
  };

  if (apiUrl !== undefined) environment[apiUrlVariable] = apiUrl;

  const call = spawnSync(
    process.execPath,
    [apiCallScript, method, path, ...(body === undefined ? [] : [body])],
    { encoding: "utf8", env: environment, stdio: ["ignore", "pipe", "pipe"] },
  );

  if (call.status !== 0) {
    throw new ClerkCliError(
      `Clerk Backend API call failed: ${call.stderr.trim().split("\n").at(-1) ?? "no answer"}`,
    );
  }

  return call.stdout;
}

function callClerk(apiCall: ApiCall): string {
  const secretKey = process.env[secretKeyVariable];

  try {
    return runClerkCli([
      "api",
      apiCall.path,
      ...(apiCall.body === undefined ? [] : ["--yes", "-d", apiCall.body]),
    ]);
  } catch (cause: unknown) {
    if (!isMissingCommand(cause) || secretKey === undefined || secretKey === "") {
      throw cliFailure(cause);
    }

    return callBackendApi(secretKey, apiCall);
  }
}

export function findSeededUserId(): string | undefined {
  const output = callClerk({
    method: "GET",
    path: `/users?email_address=${encodeURIComponent(seededUserEmail)}`,
  });

  return z.array(userSchema).parse(JSON.parse(output))[0]?.id;
}

export function seedUser(): string {
  const existingUserId = findSeededUserId();

  if (existingUserId) return existingUserId;

  const body = JSON.stringify({
    email_address: [seededUserEmail],
    skip_password_requirement: true,
  });

  return userSchema.parse(JSON.parse(callClerk({ method: "POST", path: "/users", body }))).id;
}

export function createSignInToken(userId: string): string {
  const body = JSON.stringify({ user_id: userId, expires_in_seconds: 600 });
  const output = callClerk({ method: "POST", path: "/sign_in_tokens", body });

  return signInTokenSchema.parse(JSON.parse(output)).token;
}
