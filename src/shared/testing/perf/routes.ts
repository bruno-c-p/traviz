import type { ReadyProbe } from "@/shared/testing/perf/browser";

export function selectRoutes<T extends ReadyProbe>(
  allRoutes: readonly T[],
  selectedPaths: readonly string[] | undefined,
) {
  return {
    measured: allRoutes.filter((route) => selectedPaths?.includes(route.path) ?? true),
    readyProbes: allRoutes.map(
      (route) => ({ path: route.path, expression: route.expression }) satisfies ReadyProbe,
    ),
  };
}
