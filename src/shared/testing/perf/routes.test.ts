import { expect, test } from "bun:test";
import { selectRoutes } from "@/shared/testing/perf/routes";

const allRoutes = [
  { path: "/", expression: "home", hasReturnFromList: true },
  { path: "/list", expression: "list", hasReturnFromList: false },
  { path: "/stats", expression: "stats", hasReturnFromList: false },
];

const everyProbe = [
  { path: "/", expression: "home" },
  { path: "/list", expression: "list" },
  { path: "/stats", expression: "stats" },
];

test("no selection measures and probes every route", () => {
  expect(selectRoutes(allRoutes, undefined)).toEqual({
    measured: allRoutes,
    readyProbes: everyProbe,
  });
});

test("a single selected route is the only one measured and every route keeps its probe", () => {
  const selection = selectRoutes(allRoutes, ["/"]);

  expect(selection.measured).toEqual([{ path: "/", expression: "home", hasReturnFromList: true }]);
  expect(selection.readyProbes).toEqual(everyProbe);
});

test("several selected routes are measured in the order of the route table", () => {
  expect(selectRoutes(allRoutes, ["/stats", "/"]).measured.map((route) => route.path)).toEqual([
    "/",
    "/stats",
  ]);
});
