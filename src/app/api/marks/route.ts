import countriesData from "../../../data/countries.json";
import { COUNTRY_STATES } from "../../../lib/colors";
import type { Marks } from "../../../lib/colors";
import { auth } from "../../../lib/server/auth";
import { turso } from "../../../lib/server/db";

const VALID_CODES = new Set((countriesData as { code: string }[]).map((c) => c.code));
const MAX_MARKS = VALID_CODES.size;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function requireUserId(request: Request): Promise<{ userId: string } | { response: Response }> {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return { response: json({ error: "Unauthorized" }, 401) };
    return { userId: session.user.id };
  } catch {
    return { response: json({ error: "Unauthorized" }, 401) };
  }
}

async function loadMarks(userId: string): Promise<Marks> {
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

export async function GET(request: Request): Promise<Response> {
  const authed = await requireUserId(request);
  if ("response" in authed) return authed.response;

  const marks = await loadMarks(authed.userId);
  return json({ marks });
}

export async function PUT(request: Request): Promise<Response> {
  const authed = await requireUserId(request);
  if ("response" in authed) return authed.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return json({ error: "Expected a JSON object" }, 400);
  }

  const marks = (body as { marks?: unknown }).marks;
  if (typeof marks !== "object" || marks === null || Array.isArray(marks)) {
    return json({ error: "Expected 'marks' to be an object" }, 400);
  }

  const entries = Object.entries(marks as Record<string, unknown>);
  if (entries.length > MAX_MARKS) {
    return json({ error: `Too many marks (max ${MAX_MARKS})` }, 400);
  }

  for (const [code, state] of entries) {
    if (!VALID_CODES.has(code)) {
      return json({ error: `Unknown country code: ${code}` }, 400);
    }
    if (typeof state !== "string" || !(COUNTRY_STATES as readonly string[]).includes(state)) {
      return json({ error: `Invalid state for ${code}: ${JSON.stringify(state)}` }, 400);
    }
  }

  const now = new Date().toISOString();
  await turso.batch(
    [
      { sql: "DELETE FROM marks WHERE user_id = ?", args: [authed.userId] },
      ...entries.map(([code, state]) => ({
        sql: "INSERT INTO marks (user_id, code, state, updated_at) VALUES (?, ?, ?, ?)",
        args: [authed.userId, code, String(state), now],
      })),
    ],
    "write",
  );

  return json({ marks: Object.fromEntries(entries.map(([code, state]) => [code, String(state)])) });
}

export async function DELETE(request: Request): Promise<Response> {
  const authed = await requireUserId(request);
  if ("response" in authed) return authed.response;

  await turso.execute({ sql: "DELETE FROM marks WHERE user_id = ?", args: [authed.userId] });
  return json({ marks: {} });
}
