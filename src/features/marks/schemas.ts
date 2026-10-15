import "server-only";
import { z } from "zod";
import countriesData from "@/data/countries.json";
import { COUNTRY_STATES } from "@/lib/colors";

const validCodes = new Set(countriesData.map((country) => country.code));

export const countryCodeSchema = z.string().refine((code) => validCodes.has(code), {
  message: "Unknown country code",
});

export const countryStateSchema = z.literal(COUNTRY_STATES);
