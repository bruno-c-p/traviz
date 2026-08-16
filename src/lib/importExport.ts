import { COUNTRY_STATES } from "./colors";
import type { CountryState, Marks } from "./colors";

const EXPORT_VERSION = 1;

export interface ExportedMarks {
  version: number;
  countries: Marks;
}

export type SkipReason = "unknown_code" | "invalid_state" | "invalid_value";

export interface SkippedEntry {
  code: string;
  value: unknown;
  reason: SkipReason;
}

export interface ImportSuccess {
  ok: true;
  marks: Marks;
  skipped: SkippedEntry[];
}

export interface ImportFailure {
  ok: false;
  error: string;
}

export type ImportResult = ImportSuccess | ImportFailure;

function isCountryState(value: string): value is CountryState {
  return (COUNTRY_STATES as readonly string[]).includes(value);
}

export function exportMarks(marks: Marks): string {
  const payload: ExportedMarks = { version: EXPORT_VERSION, countries: marks };
  return JSON.stringify(payload, null, 2);
}

export function importMarks(rawJsonString: string, validCodes: readonly string[]): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJsonString);
  } catch {
    return { ok: false, error: "File is not valid JSON" };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: "Expected a JSON object" };
  }

  const root = parsed as Record<string, unknown>;

  if (root.version !== EXPORT_VERSION) {
    return { ok: false, error: `Unsupported version: ${JSON.stringify(root.version)}` };
  }

  const countries = root.countries;
  if (typeof countries !== "object" || countries === null || Array.isArray(countries)) {
    return { ok: false, error: "Expected 'countries' to be an object" };
  }

  const validCodeSet = new Set(validCodes);
  const marks: Marks = {};
  const skipped: SkippedEntry[] = [];

  for (const [code, value] of Object.entries(countries as Record<string, unknown>)) {
    if (typeof value !== "string") {
      skipped.push({ code, value, reason: "invalid_value" });
      continue;
    }
    if (!validCodeSet.has(code)) {
      skipped.push({ code, value, reason: "unknown_code" });
      continue;
    }
    if (!isCountryState(value)) {
      skipped.push({ code, value, reason: "invalid_state" });
      continue;
    }
    marks[code] = value;
  }

  return { ok: true, marks, skipped };
}
