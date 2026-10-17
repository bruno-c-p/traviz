import "server-only";
import { z } from "zod";
import { COUNTRIES_BY_CODE } from "@/features/countries";
import { COUNTRY_STATES } from "@/features/marks/colors";

export const countryCodeSchema = z.string().refine((code) => COUNTRIES_BY_CODE.has(code), {
  message: "Unknown country code",
});

export const countryStateSchema = z.literal(COUNTRY_STATES);

export const markRowSchema = z.object({ code: z.string(), state: countryStateSchema });

export const markChangeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("set"), code: countryCodeSchema, state: countryStateSchema }),
  z.object({ kind: z.literal("clear"), code: countryCodeSchema }),
  z.object({ kind: z.literal("reset") }),
]);
