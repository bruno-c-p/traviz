"use client";

import { cn } from "@/shared/cn";
import { useCountriesStore } from "@/features/marks/marks-store";

export function ClearMarkButton({ code, className }: { code: string; className?: string }) {
  const hasMark = useCountriesStore((state) => Boolean(state.marks[code]));
  const clear = useCountriesStore((state) => state.clear);

  if (!hasMark) return null;

  return (
    <button
      type="button"
      onClick={() => clear(code)}
      className={cn(
        "pressable min-h-11 rounded-full px-3 text-sm font-medium text-body underline underline-offset-4 hover:text-ink",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink",
        className,
      )}
    >
      Clear mark
    </button>
  );
}
