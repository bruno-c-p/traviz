import "server-only";
import { setTimeout as wait } from "node:timers/promises";
import { answerMarkChange, answerMarksRead } from "@/features/marks/marks-api";
import type { MarksSnapshot } from "@/features/marks/marks-sync";
import { databaseMarksReader, loadMarksSnapshot } from "@/features/marks/services/marks";
import { turso } from "@/shared/server/database";
import { env } from "@/shared/server/env";

export { encodeMarksSnapshot } from "@/features/marks/marks-wire";

export { MARKS_SNAPSHOT_ID } from "@/features/marks/start-marks-session";

function logWriteError(cause: unknown): void {
  console.error("The mark change could not be written.", cause);
}

export async function loadUserMarks(userId: string | null): Promise<MarksSnapshot | null> {
  if (userId === null) return null;

  if (env.TRAVIZ_DB_DELAY_MS !== undefined) await wait(env.TRAVIZ_DB_DELAY_MS);

  return loadMarksSnapshot(databaseMarksReader, userId);
}

export function handleMarkChange(request: Request, userId: string | null): Promise<Response> {
  return answerMarkChange(request, {
    client: turso,
    getUserId: () => Promise.resolve(userId),
    logWriteError,
  });
}

export function handleMarksRead(request: Request, userId: string | null): Promise<Response> {
  return answerMarksRead(request, {
    ...databaseMarksReader,
    getUserId: () => Promise.resolve(userId),
  });
}
