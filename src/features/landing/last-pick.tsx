"use client";

import { useLandingStore } from "@/features/landing/landing-store";
import { COUNTRIES_BY_CODE } from "@/features/countries";
import { STATE_FILLS } from "@/features/landing/state-fills";
import { cn } from "@/shared/cn";

export function LastPick() {
  const focus = useLandingStore((store) => store.focus);

  const state = useLandingStore((store) =>
    store.focus ? store.marks[store.focus.code] : undefined,
  );

  const name = focus ? COUNTRIES_BY_CODE.get(focus.code)?.name : undefined;

  if (!focus || !name) return null;

  return (
    <p
      key={focus.id}
      aria-hidden="true"
      className={cn(
        "truncate rounded-sm px-2 text-sm leading-7 font-semibold motion-safe:animate-paint-in",
        state ? STATE_FILLS[state] : "bg-land text-ink line-through",
      )}
    >
      {name}
    </p>
  );
}
