"use server";

import { createApplyMarkChange } from "@/features/marks/apply-mark-change";
import { getUserId } from "@/features/auth/server";
import { turso } from "@/shared/server/database";

function logWriteError(cause: unknown): void {
  console.error("The mark change could not be written.", cause);
}

export const applyMarkChange = createApplyMarkChange({ client: turso, getUserId, logWriteError });
