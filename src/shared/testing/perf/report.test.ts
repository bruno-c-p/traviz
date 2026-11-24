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
  totalBytes: 420_000,
  documentRedirects: 0,
};

const softNavigation: Sample = {
  marksReady: 80,
  globeFrame: 120,
  scriptBytes: 0,
  totalBytes: 2_000,
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

const signedIn = { path: "/", expectGlobe: true, session: "signed in" } as const;

test("the return from /list reports the globe frame, seeded marks and bytes only", () => {
  expect(metricsOf({ ...signedIn, visit: "return from /list, cold" }, softNavigation)).toEqual([
    "/ return from /list, cold: seeded marks on screen",
    "/ return from /list, cold: first globe frame",
    "/ return from /list, cold: script bytes transferred",
    "/ return from /list, cold: all bytes transferred",
  ]);
});

test("a signed-out page names its session and reports when the landing page is on screen", () => {
  const { globeFrame: _globeFrame, ...landingLoad } = pageLoad;

  expect(
    metricsOf(
      { path: "/welcome", visit: "first visit", expectGlobe: false, session: "signed out" },
      landingLoad,
    ),
  ).toEqual([
    "/welcome signed out, first visit: TTFB",
    "/welcome signed out, first visit: FCP",
    "/welcome signed out, first visit: LCP",
    "/welcome signed out, first visit: landing page on screen",
    "/welcome signed out, first visit: script bytes transferred",
    "/welcome signed out, first visit: all bytes transferred",
  ]);
});

test("a page load reports every metric", () => {
  expect(metricsOf({ ...signedIn, visit: "first visit" }, pageLoad)).toEqual([
    "/ first visit: TTFB",
    "/ first visit: FCP",
    "/ first visit: LCP",
    "/ first visit: seeded marks on screen",
    "/ first visit: first globe frame",
    "/ first visit: script bytes transferred",
    "/ first visit: all bytes transferred",
  ]);
});
