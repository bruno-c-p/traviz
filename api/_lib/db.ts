import { createClient } from "@libsql/client";
import { LibsqlDialect } from "@libsql/kysely-libsql";
import { Kysely } from "kysely";

const config = {
  url: process.env.TURSO_DATABASE_URL as string,
  authToken: process.env.TURSO_AUTH_TOKEN as string,
};

export const turso = createClient(config);

export const dialect = new LibsqlDialect(config);

export const db = new Kysely<Record<string, never>>({ dialect });
