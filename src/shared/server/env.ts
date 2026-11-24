import "server-only";
import { z } from "zod";

const optionalText = z
  .string()
  .optional()
  .transform((value) => (value === "" ? undefined : value));

const envSchema = z
  .object({
    TURSO_DATABASE_URL: z
      .string({ error: "is required" })
      .min(1, { error: "is required", abort: true }),
    TURSO_AUTH_TOKEN: optionalText,
    TRAVIZ_FIXED_USER_ID: optionalText,
    TRAVIZ_DB_DELAY_MS: z.coerce.number().int().min(0).optional(),
    CLERK_SECRET_KEY: optionalText,
    PUBLIC_CLERK_PUBLISHABLE_KEY: optionalText,
    CLERK_AUTHORIZED_PARTIES: optionalText,
  })
  .refine(
    (variables) =>
      variables.TURSO_DATABASE_URL.startsWith("file:") || Boolean(variables.TURSO_AUTH_TOKEN),
    {
      path: ["TURSO_AUTH_TOKEN"],
      message: "is required unless TURSO_DATABASE_URL starts with file:",
    },
  )
  .refine(
    (variables) =>
      variables.TRAVIZ_FIXED_USER_ID === undefined ||
      variables.TURSO_DATABASE_URL.startsWith("file:"),
    {
      path: ["TRAVIZ_FIXED_USER_ID"],
      message: "is allowed only when TURSO_DATABASE_URL starts with file:",
    },
  )
  .refine(
    (variables) =>
      variables.TRAVIZ_DB_DELAY_MS === undefined ||
      variables.TURSO_DATABASE_URL.startsWith("file:"),
    {
      path: ["TRAVIZ_DB_DELAY_MS"],
      message: "is allowed only when TURSO_DATABASE_URL starts with file:",
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
