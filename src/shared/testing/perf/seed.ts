import { createClient } from "@libsql/client";

export type SeedPlan<T extends string> = readonly (readonly [T, number])[];

export function seededMarks<T extends string>(
  countedCodes: readonly string[],
  plan: SeedPlan<T>,
): [string, T][] {
  const states = plan.flatMap(([state, count]) => Array.from({ length: count }, () => state));

  if (states.length > countedCodes.length)
    throw new Error(
      `The seed plan needs ${states.length} countries, but only ${countedCodes.length} exist.`,
    );

  return states.map((state, index) => [countedCodes[index], state]);
}

export async function seedMarks(
  databaseUrl: string,
  userId: string,
  marks: readonly (readonly [string, string])[],
): Promise<void> {
  const client = createClient({ url: databaseUrl });
  const updatedAt = new Date(0).toISOString();

  try {
    await client.batch(
      [
        { sql: "DELETE FROM marks WHERE user_id = ?", args: [userId] },
        ...marks.map(([code, state]) => ({
          sql: "INSERT INTO marks (user_id, code, state, updated_at) VALUES (?, ?, ?, ?)",
          args: [userId, code, state, updatedAt],
        })),
      ],
      "write",
    );
  } finally {
    client.close();
  }
}
