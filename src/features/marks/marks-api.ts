import "server-only";
import { applyMarkChangeWith } from "@/features/marks/apply-mark-change";
import type { MarkChangeDependencies } from "@/features/marks/apply-mark-change";
import type { MarkChangeResult } from "@/features/marks/marks-sync";
import {
  decodeMarkChangeRequest,
  decodeOwner,
  encodeMarkChangeResult,
  encodeMarksSnapshot,
} from "@/features/marks/marks-wire";
import { createReadMarks } from "@/features/marks/services/marks";
import type { OwnMarksReader } from "@/features/marks/services/marks";

const TEXT_HEADERS = { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" };

const RESULT_STATUS: Record<"ok" | Exclude<MarkChangeResult, { ok: true }>["reason"], number> = {
  ok: 200,
  "signed-out": 401,
  "other-account": 409,
  rejected: 400,
  unavailable: 503,
};

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  const fetchSite = request.headers.get("sec-fetch-site");

  if (origin === null || host === null || !URL.canParse(origin)) return false;

  return new URL(origin).host === host && (fetchSite === null || fetchSite === "same-origin");
}

function answerResult(result: MarkChangeResult, status?: number): Response {
  return new Response(encodeMarkChangeResult(result), {
    status: status ?? RESULT_STATUS[result.ok ? "ok" : result.reason],
    headers: TEXT_HEADERS,
  });
}

export async function answerMarkChange(
  request: Request,
  dependencies: MarkChangeDependencies,
): Promise<Response> {
  if (!isSameOrigin(request)) return answerResult({ ok: false, reason: "rejected" }, 403);

  const markChange = decodeMarkChangeRequest(await request.text());

  if (markChange === null) {
    const userId = await dependencies.getUserId();

    return answerResult({ ok: false, reason: userId === null ? "signed-out" : "rejected" });
  }

  return answerResult(
    await applyMarkChangeWith(dependencies, markChange.expectedOwnerId, markChange.change),
  );
}

export async function answerMarksRead(request: Request, reader: OwnMarksReader): Promise<Response> {
  if (!isSameOrigin(request)) return new Response("", { status: 403, headers: TEXT_HEADERS });

  const expectedOwnerId = decodeOwner(await request.text());

  if (expectedOwnerId === null) return new Response("", { status: 400, headers: TEXT_HEADERS });

  const snapshot = await createReadMarks(reader)(expectedOwnerId);

  return new Response(encodeMarksSnapshot(snapshot), {
    status: snapshot.ok ? 200 : 503,
    headers: TEXT_HEADERS,
  });
}
