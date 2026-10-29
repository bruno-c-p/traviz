"use client";

import type { Ref } from "react";
import { nextState } from "@/features/landing/landing-marks";
import { useLandingStore } from "@/features/landing/landing-store";
import { STATE_LABELS } from "@/features/marks";
import { STATE_FILLS } from "@/features/landing/state-fills";
import { cn } from "@/shared/cn";

type NameButtonProps = {
  code: string;
  name: string;
  isTabStop: boolean;
  onFocus: () => void;
  ref: Ref<HTMLButtonElement>;
};

export function NameButton({ code, name, isTabStop, onFocus, ref }: NameButtonProps) {
  const state = useLandingStore((store) => store.marks[code]);
  const pick = useLandingStore((store) => store.pick);

  return (
    <button
      ref={ref}
      type="button"
      tabIndex={isTabStop ? 0 : -1}
      data-next={nextState(state) ?? "unmarked"}
      onFocus={onFocus}
      onClick={() => pick(code)}
      className={cn(
        "relative inline-block rounded-sm px-[0.28em] text-left font-medium whitespace-nowrap text-mute transition-colors duration-200 ease-out hover:text-ink focus-visible:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink",
        "after:pointer-events-none after:absolute after:inset-x-[0.28em] after:bottom-[0.08em] after:h-[3px] after:origin-left after:scale-x-0 after:rounded-full after:transition-transform after:duration-240 after:ease-out hover:after:scale-x-100 focus-visible:after:scale-x-100 motion-reduce:after:transition-none",
        "data-[next=visited]:after:bg-primary data-[next=want]:after:bg-want data-[next=not_interested]:after:bg-skip data-[next=unmarked]:after:bg-mute",
      )}
    >
      {name}
      {state && (
        <>
          <span
            key={state}
            aria-hidden="true"
            className={cn(
              "absolute inset-0 rounded-sm px-[0.28em] motion-safe:animate-paint-in",
              STATE_FILLS[state],
            )}
          >
            {name}
          </span>
          <span className="sr-only">, {STATE_LABELS[state]}</span>
        </>
      )}
    </button>
  );
}
