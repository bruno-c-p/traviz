import "server-only";
import { createClient } from "@libsql/client";
import { env } from "@/shared/server/env";

export const turso = createClient({
  url: env.TURSO_DATABASE_URL,
  authToken: env.TURSO_AUTH_TOKEN,
});
