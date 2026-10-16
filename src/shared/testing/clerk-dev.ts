import { execFileSync } from "node:child_process";
import { z } from "zod";

export const seededUserEmail = "agent+clerk_test@example.com";

const userSchema = z.object({ id: z.string() });
const signInTokenSchema = z.object({ token: z.string() });

export function runClerkDev(args: string[]): string {
  return execFileSync("clerk", [...args, "--instance", "dev"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
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
