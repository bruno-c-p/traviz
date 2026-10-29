function importGlobe() {
  return Promise.all([
    import("@/features/globe/create-globe"),
    import("@/features/globe/country-topology.generated"),
  ]).then(([engine, data]) => ({
    createGlobe: engine.createGlobe,
    topology: data.COUNTRY_TOPOLOGY,
  }));
}

type GlobeModules = Awaited<ReturnType<typeof importGlobe>>;

let globeModulesPromise: Promise<GlobeModules | null> | null = null;

export function loadGlobe() {
  globeModulesPromise ??= importGlobe().catch((cause: unknown) => {
    console.error("The globe could not load.", cause);
    globeModulesPromise = null;

    return null;
  });

  return globeModulesPromise;
}
