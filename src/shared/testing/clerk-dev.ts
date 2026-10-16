import { execFileSync } from "node:child_process";
import { z } from "zod";

export const seededUserEmail = "agent+clerk_test@example.com";

const userSchema = z.object({ id: z.string() });
const signInTokenSchema = z.object({ token: z.string() });

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

export function runClerkDev(args: string[]): string {
  const environment = { ...process.env };

  for (const name of Object.keys(environment))
    if (name.startsWith("CLERK_") || name === "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY")
      delete environment[name];

  try {
    return execFileSync("clerk", [...args, "--instance", "dev"], {
      encoding: "utf8",
      env: environment,
      stdio: ["ignore", "pipe", "inherit"],
    });
  } catch (cause: unknown) {
    throw new ClerkCliError(
      `clerk CLI missing or not logged in: install it and run clerk auth login, then rerun bun run setup (${cause instanceof Error ? cause.message : String(cause)})`,
    );
  }
}

export function findSeededUserId(): string | undefined {
  const output = runClerkDev([
    "api",
    `/users?email_address=${encodeURIComponent(seededUserEmail)}`,
  ]);

  return z.array(userSchema).parse(JSON.parse(output))[0]?.id;
}

export function seedUser(): string {
  const existingUserId = findSeededUserId();

  if (existingUserId) return existingUserId;

  const body = JSON.stringify({
    email_address: [seededUserEmail],
    skip_password_requirement: true,
  });

  return userSchema.parse(JSON.parse(runClerkDev(["api", "/users", "--yes", "-d", body]))).id;
}

export function createSignInToken(userId: string): string {
  const body = JSON.stringify({ user_id: userId, expires_in_seconds: 600 });
  const output = runClerkDev(["api", "/sign_in_tokens", "--yes", "-d", body]);

  return signInTokenSchema.parse(JSON.parse(output)).token;
}
