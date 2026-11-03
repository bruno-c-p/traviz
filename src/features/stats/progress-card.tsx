"use client";

import Link from "next/link";
import { STATE_COLORS, useHasMarksSeed, useMarks } from "@/features/marks";
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
  const hasMarksSeed = useHasMarksSeed();
  const { visited, want, total, excluded, percent } = visitedProgress(marks);
  const reachableWidth = (total / (total + excluded)) * 100;
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
              "mark-count font-bold tracking-tight text-primary",
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
      <span className={cn("flex gap-1", variantClasses.bar)}>
        <span
          className="block overflow-hidden rounded-full bg-ink-deep-soft transition-[width] duration-300 ease-out"
          style={{ width: `${reachableWidth}%` }}
        >
          <span
            className="mark-count block h-full rounded-full transition-transform duration-300 ease-out"
            style={{
              transform: `translateX(${percent - 100}%)`,
              backgroundColor: STATE_COLORS.visited,
            }}
          />
        </span>
        {excluded > 0 && (
          <span
            className="mark-count block flex-1 rounded-full bg-[repeating-linear-gradient(135deg,var(--color-ink-deep-soft)_0_4px,transparent_4px_8px)]"
            aria-hidden
          />
        )}
      </span>
      {variant === "hero" && excluded > 0 && (
        <span className="mark-count -mt-1 text-[13px] text-primary-neutral">
          {`${excluded} not interested left out`}
        </span>
      )}
      {variant === "panel" && (
        <>
          <span className="grid grid-cols-2 gap-3 pt-1">
            <span className="flex flex-col gap-0.5">
              <span className="mark-count text-2xl font-bold tabular-nums">{want}</span>
              <span className="text-[13px] text-primary-neutral">want to go</span>
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="mark-count text-2xl font-bold tabular-nums">{excluded}</span>
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
        aria-label={
          hasMarksSeed ? `${visited} of ${total} countries visited. See all stats` : "See all stats"
        }
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
