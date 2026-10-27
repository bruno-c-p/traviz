"use client";

import Link from "next/link";
import { STATE_COLORS, tallyMarks, useMarks } from "@/features/marks";
import { countries } from "@/features/countries";
import { visitedProgress } from "@/features/stats/visited-progress";
import { cn } from "@/shared/cn";
import { statsPath } from "@/paths";

type ProgressCardVariant = "hero" | "panel" | "peek";

const VARIANT_CLASSES: Record<
  ProgressCardVariant,
  { container: string; number: string; total: string; bar: string }
> = {
  hero: {
    container: "gap-4 rounded-[28px] p-6 md:p-7",
    number: "text-7xl md:text-8xl",
    total: "text-lg md:text-xl",
    bar: "h-2.5",
  },
  panel: {
    container: "gap-3.5 rounded-3xl p-5",
    number: "text-5xl",
    total: "text-lg",
    bar: "h-2",
  },
  peek: {
    container: "gap-2.5 rounded-3xl px-5 py-4",
    number: "text-3xl",
    total: "text-[15px]",
    bar: "h-1.5",
  },
};

type ProgressCardProps = {
  variant: ProgressCardVariant;
  className?: string;
};

export function ProgressCard({ variant, className }: ProgressCardProps) {
  const marks = useMarks();
  const { visited, total, percent } = visitedProgress(marks);
  const allEntries = tallyMarks(countries, marks);
  const variantClasses = VARIANT_CLASSES[variant];

  const content = (
    <>
      {variant !== "peek" && (
        <span className="font-mono text-xs uppercase tracking-wider text-primary-neutral">
          Countries visited
        </span>
      )}
      <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="flex flex-wrap items-baseline gap-x-2.5 tabular-nums">
          <span
            className={cn(
              "mark-count font-bold leading-[0.9] tracking-tight text-primary",
              variantClasses.number,
            )}
          >
            {visited}
          </span>
          <span className={cn("mark-count text-primary-neutral", variantClasses.total)}>
            {variant === "peek" ? `/ ${total} visited` : `of ${total} · ${percent.toFixed(1)}%`}
          </span>
        </span>
        {variant === "peek" && (
          <span className="mark-count font-mono text-[13px] text-primary-neutral">
            {percent.toFixed(1)}%
          </span>
        )}
      </span>
      <span
        className={cn("block overflow-hidden rounded-full bg-ink-deep-soft", variantClasses.bar)}
      >
        <span
          className="mark-count block h-full rounded-full transition-transform duration-300 ease-out"
          style={{
            transform: `translateX(${percent - 100}%)`,
            backgroundColor: STATE_COLORS.visited,
          }}
        />
      </span>
      {variant === "panel" && (
        <>
          <span className="grid grid-cols-2 gap-3 pt-1">
            <span className="flex flex-col gap-0.5">
              <span className="mark-count text-2xl font-bold tabular-nums">{allEntries.want}</span>
              <span className="text-[13px] text-primary-neutral">want to go</span>
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="mark-count text-2xl font-bold tabular-nums">
                {allEntries.not_interested}
              </span>
              <span className="text-[13px] text-primary-neutral">not interested</span>
            </span>
          </span>
          <Link
            href={statsPath()}
            className="self-start rounded-md text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            See all stats
          </Link>
        </>
      )}
    </>
  );

  const containerClassName = cn(
    "flex flex-col bg-ink-deep text-canvas",
    variantClasses.container,
    className,
  );

  if (variant === "peek") {
    return (
      <Link
        href={statsPath()}
        aria-label={`${visited} of ${total} countries visited. See all stats`}
        className={cn(
          containerClassName,
          "pressable shadow-float focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2",
        )}
      >
        {content}
      </Link>
    );
  }

  return (
    <section aria-label="Countries visited" className={containerClassName}>
      {content}
    </section>
  );
}
