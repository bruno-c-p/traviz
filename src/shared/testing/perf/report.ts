import type { Sample } from "@/shared/testing/perf/browser";
import { judge, type Judgment, type Unit } from "@/shared/testing/perf/stats";

export type Side = "baseline" | "candidate";

export type Visit = "first visit" | "repeat visit";

export type Scenario = { path: string; visit: Visit; expectGlobe: boolean };

type Metric = { key: keyof Sample; label: string; unit: Unit };

const metrics: Metric[] = [
  { key: "ttfb", label: "TTFB", unit: "ms" },
  { key: "fcp", label: "FCP", unit: "ms" },
  { key: "lcp", label: "LCP", unit: "ms" },
  { key: "marksReady", label: "seeded marks on screen", unit: "ms" },
  { key: "globeFrame", label: "first globe frame", unit: "ms" },
  { key: "scriptBytes", label: "script bytes transferred", unit: "bytes" },
];

export type MetricRow = Judgment & {
  scenario: string;
  metric: string;
  test: string;
};

export function scenarioName(scenario: Scenario): string {
  return `${scenario.path} ${scenario.visit}`;
}

export function buildRows(
  scenarios: Scenario[],
  samples: Map<string, Record<Side, Sample[]>>,
): MetricRow[] {
  return scenarios.flatMap((scenario) => {
    const name = scenarioName(scenario);
    const sides = samples.get(name);

    if (!sides) return [];

    return metrics.flatMap((metric): MetricRow[] => {
      const baselineValues = sides.baseline.flatMap((sample) => sample[metric.key] ?? []);
      const candidateValues = sides.candidate.flatMap((sample) => sample[metric.key] ?? []);

      if (baselineValues.length === 0 || candidateValues.length === 0) return [];

      const judgment = judge(baselineValues, candidateValues, metric.unit);

      return [
        {
          scenario: name,
          metric: metric.label,
          ...judgment,
          test:
            judgment.unit === "bytes"
              ? `±${formatValue(judgment.threshold, "bytes")}`
              : `p=${judgment.p.toFixed(3)}, ≥${formatValue(judgment.threshold, "ms")}`,
        },
      ];
    });
  });
}

function formatValue(value: number, unit: Unit): string {
  return unit === "ms" ? `${Math.round(value)} ms` : `${(value / 1024).toFixed(1)} KB`;
}

export function formatRows(rows: MetricRow[]): string {
  const header = ["scenario", "metric", "baseline", "candidate", "delta", "n", "test", "verdict"];

  const cells = rows.map((row) => [
    row.scenario,
    row.metric,
    `${formatValue(row.baseline.median, row.unit)} ± ${formatValue(row.baseline.mad, row.unit)}`,
    `${formatValue(row.candidate.median, row.unit)} ± ${formatValue(row.candidate.mad, row.unit)}`,
    `${row.delta > 0 ? "+" : ""}${formatValue(row.delta, row.unit)}`,
    `${row.baseline.runs}/${row.candidate.runs}`,
    row.test,
    row.verdict,
  ]);

  const widths = header.map((title, column) =>
    Math.max(title.length, ...cells.map((line) => line[column].length)),
  );

  const formatLine = (line: string[]): string =>
    line
      .map((cell, column) => cell.padEnd(widths[column]))
      .join("  ")
      .trimEnd();

  return [formatLine(header), ...cells.map(formatLine)].join("\n");
}
