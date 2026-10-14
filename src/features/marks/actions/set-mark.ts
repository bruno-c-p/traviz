"use server";

import { countryCodeSchema, countryStateSchema } from "@/features/marks/schemas";
import { upsertMarkForUser } from "@/features/marks/services/marks";
import type { CountryState } from "@/lib/colors";
import { requireUserId } from "@/lib/server/session";

export async function setMarkAction(code: string, state: CountryState): Promise<void> {
  const userId = await requireUserId();
  const parsedCode = countryCodeSchema.parse(code);
  const parsedState = countryStateSchema.parse(state);
  await upsertMarkForUser(userId, parsedCode, parsedState);
}
