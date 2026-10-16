export type Summary = { median: number; mad: number; runs: number };

export type Unit = "ms" | "bytes";

export type Verdict = "within noise" | "faster" | "slower" | "smaller" | "larger";

export const significanceLevel = 0.01;

function medianOf(values: number[]): number {
  const sorted = values.toSorted((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function summarize(values: number[]): Summary {
  const median = medianOf(values);

  return {
    median,
    mad: medianOf(values.map((value) => Math.abs(value - median))),
    runs: values.length,
  };
}

function countArrangementsByU(baselineRuns: number, candidateRuns: number): number[] {
  let table = Array.from({ length: candidateRuns + 1 }, () => [1]);

  for (let placedBaseline = 1; placedBaseline <= baselineRuns; placedBaseline++) {
    const next: number[][] = [[1]];

    for (let placedCandidate = 1; placedCandidate <= candidateRuns; placedCandidate++) {
      const withCandidateLast = next[placedCandidate - 1];
      const withBaselineLast = table[placedCandidate];
      const size = placedBaseline * placedCandidate + 1;

      next.push(
        Array.from(
          { length: size },
          (_, u) => (withCandidateLast[u] ?? 0) + (withBaselineLast[u - placedCandidate] ?? 0),
        ),
      );
    }

    table = next;
  }

  return table[candidateRuns];
}

export function mannWhitneyP(baselineValues: number[], candidateValues: number[]): number {
  let u = 0;

  for (const baseline of baselineValues)
    for (const candidate of candidateValues)
      if (baseline > candidate) u += 1;
      else if (baseline === candidate) u += 0.5;

  const counts = countArrangementsByU(baselineValues.length, candidateValues.length);
  const total = counts.reduce((sum, count) => sum + count, 0);
  const atMost = counts.slice(0, Math.ceil(u) + 1).reduce((sum, count) => sum + count, 0);
  const atLeast = counts.slice(Math.floor(u)).reduce((sum, count) => sum + count, 0);

  return Math.min(1, (2 * Math.min(atMost, atLeast)) / total);
}

export const timingFloor = { ms: 50, share: 0.05 };

export const byteTolerance = { bytes: 1024, share: 0.01 };

type Comparison = { baseline: Summary; candidate: Summary; delta: number; threshold: number };

export type Judgment =
  | (Comparison & { unit: "bytes"; verdict: Verdict })
  | (Comparison & { unit: "ms"; p: number; verdict: Verdict });

export function judge(baselineValues: number[], candidateValues: number[], unit: Unit): Judgment {
  const baseline = summarize(baselineValues);
  const candidate = summarize(candidateValues);
  const delta = candidate.median - baseline.median;

  if (unit === "bytes") {
    const threshold = Math.max(byteTolerance.bytes, baseline.median * byteTolerance.share);

    const verdict =
      Math.abs(delta) <= threshold ? "within noise" : delta < 0 ? "smaller" : "larger";

    return { unit, baseline, candidate, delta, threshold, verdict };
  }

  const threshold = Math.max(timingFloor.ms, baseline.median * timingFloor.share);
  const p = mannWhitneyP(baselineValues, candidateValues);
  const isChange = p < significanceLevel && Math.abs(delta) >= threshold;
  const verdict = !isChange ? "within noise" : delta < 0 ? "faster" : "slower";

  return { unit, baseline, candidate, delta, threshold, p, verdict };
}
