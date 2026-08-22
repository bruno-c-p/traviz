import { getMigrations } from "better-auth/db/migration";
import { auth } from "../api/_lib/auth.ts";
import { turso } from "../api/_lib/db.ts";

async function main(): Promise<void> {
  const { toBeCreated, toBeAdded, runMigrations } = await getMigrations(auth.options);

  if (toBeCreated.length === 0 && toBeAdded.length === 0) {
    console.log("better-auth schema is up to date");
  } else {
    await runMigrations();
    console.log(
      `better-auth migrations applied — created: [${toBeCreated.map((t) => t.table).join(", ")}], altered: [${toBeAdded.map((t) => t.table).join(", ")}]`,
    );
  }

  await turso.execute(`
    CREATE TABLE IF NOT EXISTS marks (
      user_id TEXT NOT NULL,
      code TEXT NOT NULL,
      state TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, code)
    )
  `);
  console.log("marks table ensured");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
