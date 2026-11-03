import { SOVEREIGN_COUNTRIES } from "@/features/countries";
import { type Marks, tallyMarks, tallyTotal } from "@/features/marks";

export function visitedProgress(marks: Marks) {
  const headline = tallyMarks(SOVEREIGN_COUNTRIES, marks);
  const excluded = headline.not_interested;
  const total = tallyTotal(headline) - excluded;

  return {
    visited: headline.visited,
    want: headline.want,
    total,
    excluded,
    percent: total > 0 ? (headline.visited / total) * 100 : 0,
  };
}
