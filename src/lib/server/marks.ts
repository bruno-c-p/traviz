import countriesData from "@/data/countries.json";
import { COUNTRY_STATES } from "@/lib/colors";
import type { Marks } from "@/lib/colors";
import { turso } from "@/lib/server/db";

const VALID_CODES = new Set((countriesData as { code: string }[]).map((c) => c.code));
const MAX_MARKS = VALID_CODES.size;

export async function loadMarks(userId: string): Promise<Marks> {
  const result = await turso.execute({
    sql: "SELECT code, state FROM marks WHERE user_id = ?",
    args: [userId],
  });
  const marks: Marks = {};
  for (const row of result.rows) {
    marks[String(row.code)] = String(row.state) as Marks[string];
  }
  return marks;
}

function validateMarks(marks: unknown): Marks {
  if (typeof marks !== "object" || marks === null || Array.isArray(marks)) {
    throw new Error("Expected 'marks' to be an object");
  }

  const entries = Object.entries(marks as Record<string, unknown>);
  if (entries.length > MAX_MARKS) {
    throw new Error(`Too many marks (max ${MAX_MARKS})`);
  }

  for (const [code, state] of entries) {
    if (!VALID_CODES.has(code)) {
      throw new Error(`Unknown country code: ${code}`);
    }
    if (typeof state !== "string" || !(COUNTRY_STATES as readonly string[]).includes(state)) {
      throw new Error(`Invalid state for ${code}: ${JSON.stringify(state)}`);
    }
  }

  return Object.fromEntries(entries) as Marks;
}

export async function saveMarksForUser(userId: string, marks: Marks): Promise<void> {
  const validated = validateMarks(marks);
  const entries = Object.entries(validated);
  const now = new Date().toISOString();

  await turso.batch(
    [
      { sql: "DELETE FROM marks WHERE user_id = ?", args: [userId] },
      ...entries.map(([code, state]) => ({
        sql: "INSERT INTO marks (user_id, code, state, updated_at) VALUES (?, ?, ?, ?)",
        args: [userId, code, String(state), now],
      })),
    ],
    "write",
  );
}

export async function clearMarksForUser(userId: string): Promise<void> {
  await turso.execute({ sql: "DELETE FROM marks WHERE user_id = ?", args: [userId] });
}
