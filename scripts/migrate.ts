import { turso } from "../src/shared/server/database.ts";

async function main(): Promise<void> {
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

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
