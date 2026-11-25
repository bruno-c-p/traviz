import { COUNTRY_STATES, type Marks } from "@/features/marks/colors";
import type {
  MarkChange,
  MarkChangeFailure,
  MarkChangeResult,
  MarksSnapshot,
} from "@/features/marks/marks-sync";

const OWNER_FIELD = "owner";
const STATUS_FIELD = "status";
const KIND_FIELD = "kind";
const CODE_FIELD = "code";
const STATE_FIELD = "state";
const SAVED_TEXT = "ok";

const FAILURES: readonly MarkChangeFailure[] = [
  "signed-out",
  "other-account",
  "rejected",
  "unavailable",
];

export type MarkChangeRequest = {
  readonly expectedOwnerId: string;
  readonly change: MarkChange;
};

export function encodeMarkChangeRequest({ expectedOwnerId, change }: MarkChangeRequest): string {
  const fields = new URLSearchParams({ [OWNER_FIELD]: expectedOwnerId, [KIND_FIELD]: change.kind });

  if (change.kind !== "reset") fields.set(CODE_FIELD, change.code);

  if (change.kind === "set") fields.set(STATE_FIELD, change.state);

  return fields.toString();
}

function decodeChange(fields: URLSearchParams): MarkChange | null {
  const kind = fields.get(KIND_FIELD);
  const code = fields.get(CODE_FIELD);
  const state = COUNTRY_STATES.find((countryState) => countryState === fields.get(STATE_FIELD));

  if (kind === "reset") return { kind };

  if (code === null) return null;

  if (kind === "clear") return { kind, code };

  return kind === "set" && state !== undefined ? { kind, code, state } : null;
}

export function decodeMarkChangeRequest(text: string): MarkChangeRequest | null {
  const fields = new URLSearchParams(text);
  const expectedOwnerId = fields.get(OWNER_FIELD);
  const change = decodeChange(fields);

  return expectedOwnerId === null || expectedOwnerId === "" || change === null
    ? null
    : { expectedOwnerId, change };
}

export function encodeMarkChangeResult(result: MarkChangeResult): string {
  return result.ok ? SAVED_TEXT : result.reason;
}

export function decodeMarkChangeResult(text: string): MarkChangeResult {
  if (text === SAVED_TEXT) return { ok: true };

  return { ok: false, reason: FAILURES.find((failure) => failure === text) ?? "unavailable" };
}

export function encodeOwner(ownerId: string): string {
  return new URLSearchParams({ [OWNER_FIELD]: ownerId }).toString();
}

export function decodeOwner(text: string): string | null {
  const ownerId = new URLSearchParams(text).get(OWNER_FIELD);

  return ownerId === "" ? null : ownerId;
}

export function encodeMarksSnapshot(snapshot: MarksSnapshot): string {
  const fields = new URLSearchParams({
    [OWNER_FIELD]: snapshot.ownerId,
    [STATUS_FIELD]: snapshot.ok ? "ok" : "failed",
  });

  if (snapshot.ok) {
    for (const [code, state] of Object.entries(snapshot.marks)) fields.set(code, state);
  }

  return fields.toString();
}

export function decodeMarksSnapshot(text: string): MarksSnapshot | null {
  const fields = new URLSearchParams(text);
  const ownerId = fields.get(OWNER_FIELD);
  const status = fields.get(STATUS_FIELD);

  if (ownerId === null || ownerId === "") return null;

  if (status !== "ok") return { ok: false, ownerId };

  fields.delete(OWNER_FIELD);
  fields.delete(STATUS_FIELD);

  const marks: Marks = {};

  for (const [code, mark] of fields) {
    const state = COUNTRY_STATES.find((countryState) => countryState === mark);

    if (state === undefined) return { ok: false, ownerId };

    marks[code] = state;
  }

  return { ok: true, ownerId, marks };
}
