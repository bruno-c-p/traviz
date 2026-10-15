import "server-only";
import { z } from "zod";

const envSchema = z
  .object({
    TURSO_DATABASE_URL: z.string({ error: "is required" }).min(1, "is required"),
    TURSO_AUTH_TOKEN: z.string().optional(),
  })
  .refine(
    (variables) =>
      variables.TURSO_DATABASE_URL.startsWith("file:") || Boolean(variables.TURSO_AUTH_TOKEN),
    {
      path: ["TURSO_AUTH_TOKEN"],
      message: "is required unless TURSO_DATABASE_URL starts with file:",
    },
  );

function parseEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `${issue.path.join(".")} ${issue.message}`);

    throw new Error(`Invalid environment: ${problems.join("; ")}`);
  }

  return parsed.data;
}

export const env = parseEnv();
