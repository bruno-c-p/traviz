import type { CountryState } from "@/features/marks";

export const STATE_FILLS: Record<CountryState, string> = {
  visited: "bg-primary text-on-primary",
  want: "bg-want text-white",
  not_interested: "bg-skip text-ink",
};
