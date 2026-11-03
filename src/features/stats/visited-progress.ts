import { countries } from "@/features/countries";
import { type Marks, tallyMarks, tallyTotal } from "@/features/marks";

export function visitedProgress(marks: Marks) {
  const places = tallyMarks(countries, marks);
  const excluded = places.not_interested;
  const total = tallyTotal(places) - excluded;

  return {
    visited: places.visited,
    want: places.want,
    total,
    excluded,
    percent: total > 0 ? (places.visited / total) * 100 : 0,
  };
}
