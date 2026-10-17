import { expect, test } from "bun:test";
import type { Sample } from "@/shared/testing/perf/browser";
import { buildRows, scenarioName, type Scenario, type Side } from "@/shared/testing/perf/report";

const pageLoad: Sample = {
  ttfb: 200,
  fcp: 400,
  lcp: 500,
  marksReady: 900,
  globeFrame: 1200,
  scriptBytes: 300_000,
  documentRedirects: 0,
};

const softNavigation: Sample = {
  marksReady: 80,
  globeFrame: 120,
  scriptBytes: 0,
  documentRedirects: 0,
};

function metricsOf(scenario: Scenario, sample: Sample): string[] {
  const sides: Record<Side, Sample[]> = {
    baseline: Array.from({ length: 5 }, () => sample),
    candidate: Array.from({ length: 5 }, () => sample),
  };

  return buildRows([scenario], new Map([[scenarioName(scenario), sides]])).map(
    (row) => `${row.scenario}: ${row.metric}`,
  );
}

test("the return from /list reports the globe frame, seeded marks and script bytes only", () => {
  expect(
    metricsOf({ path: "/", visit: "return from /list", expectGlobe: true }, softNavigation),
  ).toEqual([
    "/ return from /list: seeded marks on screen",
    "/ return from /list: first globe frame",
    "/ return from /list: script bytes transferred",
  ]);
});

test("a page load reports every metric", () => {
  expect(metricsOf({ path: "/", visit: "first visit", expectGlobe: true }, pageLoad)).toEqual([
    "/ first visit: TTFB",
    "/ first visit: FCP",
    "/ first visit: LCP",
    "/ first visit: seeded marks on screen",
    "/ first visit: first globe frame",
    "/ first visit: script bytes transferred",
  ]);
});
