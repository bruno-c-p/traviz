import "server-only";
import { createClient } from "@libsql/client";

const config = {
  url: process.env.TURSO_DATABASE_URL as string,
  authToken: process.env.TURSO_AUTH_TOKEN as string,
};

export const turso = createClient(config);
