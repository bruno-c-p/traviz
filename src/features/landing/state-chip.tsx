import { STATE_LABELS } from "@/features/marks";
import type { CountryState } from "@/features/marks";
import { STATE_FILLS } from "@/features/landing/state-fills";
import { cn } from "@/shared/cn";

type StateChipProps = { state: CountryState; className?: string };

export function StateChip({ state, className }: StateChipProps) {
  return (
    <span
      className={cn(
        "inline-block rounded-sm px-[0.4em] font-semibold whitespace-nowrap",
        STATE_FILLS[state],
        className,
      )}
    >
      {STATE_LABELS[state]}
    </span>
  );
}
