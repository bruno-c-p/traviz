import { tallyMarks, tallyTotal } from "@/features/marks/core";
import type { Marks } from "@/features/marks/core";

export type ProgressModel = {
  readonly visited: number;
  readonly want: number;
  readonly total: number;
  readonly excluded: number;
  readonly percentText: string;
  readonly reachableWidth: number;
  readonly visitedOffset: number;
  readonly summary: string;
};

export function progressModel(pool: readonly { code: string }[], marks: Marks): ProgressModel {
  const places = tallyMarks(pool, marks);
  const excluded = places.not_interested;
  const total = tallyTotal(places) - excluded;
  const percent = total > 0 ? (places.visited / total) * 100 : 0;

  return {
    visited: places.visited,
    want: places.want,
    total,
    excluded,
    percentText: `${percent.toFixed(1)}%`,
    reachableWidth: total + excluded > 0 ? (total / (total + excluded)) * 100 : 100,
    visitedOffset: percent - 100,
    summary: `${places.visited} of ${total} places visited. See all stats`,
  };
}

export function progressTotalText(model: ProgressModel, variant: "panel" | "peek"): string {
  return variant === "peek"
    ? `/ ${model.total} visited`
    : `of ${model.total} · ${model.percentText}`;
}
