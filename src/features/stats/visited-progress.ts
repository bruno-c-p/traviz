import { SOVEREIGN_COUNTRIES } from "@/features/countries";
import { type Marks, tallyMarks, tallyShare, tallyTotal } from "@/features/marks";

export function visitedProgress(marks: Marks) {
  const headline = tallyMarks(SOVEREIGN_COUNTRIES, marks);

  return {
    visited: headline.visited,
    total: tallyTotal(headline),
    percent: tallyShare(headline, "visited"),
  };
}
