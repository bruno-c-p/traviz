import "server-only";
import { z } from "zod";

const envSchema = z
  .object({
    TURSO_DATABASE_URL: z
      .string({ error: "is required" })
      .min(1, { error: "is required", abort: true }),
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

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const problems = parsedEnv.error.issues.map(
    (issue) => `${issue.path.join(".")} ${issue.message}`,
  );

  throw new Error(`Invalid environment: ${problems.join("; ")}`);
}

export const env = parsedEnv.data;
