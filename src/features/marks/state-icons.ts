import { Ban, Check, Star } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { CountryState } from "@/features/marks/colors";

export const STATE_ICONS: Record<CountryState, LucideIcon> = {
  visited: Check,
  want: Star,
  not_interested: Ban,
};
