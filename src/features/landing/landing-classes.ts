import type { CountryState, StateColorKey } from "@/features/marks/core";

export const STATE_FILLS: Record<CountryState, string> = {
  visited: "bg-primary text-on-primary",
  want: "bg-want text-white",
  not_interested: "bg-skip text-ink",
};

export const NAME_PAINT_CLASS =
  "absolute inset-0 rounded-sm px-[0.28em] motion-safe:animate-paint-in";

export const STATE_CHIP_CLASS =
  "inline-block rounded-sm px-[0.4em] font-semibold whitespace-nowrap";

export const LIST_STATE_CLASS = "text-xs leading-6";

export const LAST_PICK_CLASS =
  "truncate rounded-sm px-2 text-sm leading-7 font-semibold motion-safe:animate-paint-in";

export const LAST_PICK_CLEARED_CLASS = "bg-land text-ink line-through";

export const CELL_CLASS =
  "size-3.5 rounded-[3px] transition-colors duration-300 ease-out motion-reduce:transition-none";

export const CELL_FILLS: Record<StateColorKey, string> = {
  visited: "bg-primary",
  want: "bg-want",
  not_interested: "bg-skip",
  unmarked: "bg-line",
};
