import { createMarksTableSql } from "@/shared/server/marks-table";
import { turso } from "@/shared/server/database";

async function main(): Promise<void> {
  await turso.execute(createMarksTableSql);
  console.log("marks table ensured");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
