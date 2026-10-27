import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { geoCentroid, geoDistance } from "d3-geo";
import type { FeatureCollection } from "geojson";
import { feature, mergeArcs } from "topojson-client";
import { topology } from "topojson-server";
import { presimplify, quantile, simplify } from "topojson-simplify";
import type { ArcIndexes, GeometryCollection, Topology } from "topojson-specification";
import countries from "world-countries";
import { z } from "zod";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const countriesRelativePath = "src/features/countries/countries.generated.ts";
const topologyRelativePath = "src/features/globe/country-topology.generated.ts";
const atlasPath = fileURLToPath(import.meta.resolve("world-atlas/countries-50m.json"));

const COUNTED_OBSERVER_STATES = new Set(["PSE"]);
const EXPECTED_SOVEREIGN_COUNT = 195;
const LABEL_MIN_TERRITORY_AREA = 100000;
const FALLBACK_FLAG = "🏳️";

const KEPT_POINT_SHARE = 0.15;
const TOPOLOGY_QUANTIZATION = 1e4;

const CODES_BY_ATLAS_NAME = new Map([
  ["Kosovo", ["UNK"]],
  ["Somaliland", ["SOM"]],
  ["N. Cyprus", ["CYP"]],
  ["Indian Ocean Ter.", ["CXR", "CCK"]],
]);

const OVERSEAS_CODES = new Map([
  ["FRA", ["GUF", "GLP", "MTQ", "REU", "MYT"]],
  ["NLD", ["BES"]],
  ["NOR", ["SJM", "BVT"]],
]);

type WorldCountry = (typeof countries)[number];

function mapRegionToContinent(country: WorldCountry): string {
  if (country.region === "Americas") {
    return country.subregion === "South America" ? "South America" : "North America";
  }

  if (country.region === "Antarctic") return "Antarctica";

  if (["Africa", "Asia", "Europe", "Oceania"].includes(country.region)) return country.region;

  throw new Error(
    `Unmapped continent for ${country.name.common}: region="${country.region}", subregion="${country.subregion}"`,
  );
}

function toRecord(country: WorldCountry) {
  const kind =
    country.unMember || COUNTED_OBSERVER_STATES.has(country.cca3) ? "sovereign" : "territory";

  const [latitude, longitude] = country.latlng;

  return {
    code: country.cca3,
    name: country.name.common,
    flag: country.flag.trim() === "" ? FALLBACK_FLAG : country.flag,
    continent: mapRegionToContinent(country),
    kind,
    center: [longitude, latitude],
    area: country.area,
    hasGlobeLabel: kind === "sovereign" || country.area >= LABEL_MIN_TERRITORY_AREA,
  };
}

const records = countries
  .map(toRecord)
  .sort((first, second) => first.name.localeCompare(second.name, "en"));

const sovereignCount = records.filter((record) => record.kind === "sovereign").length;

if (sovereignCount !== EXPECTED_SOVEREIGN_COUNT) {
  throw new Error(`Expected ${EXPECTED_SOVEREIGN_COUNT} sovereign entries, got ${sovereignCount}`);
}

const atlasGeometryFields = {
  id: z.string().optional(),
  properties: z.object({ name: z.string() }),
};

const pairSchema = z.tuple([z.number(), z.number()]);

const atlasSchema = z.object({
  type: z.literal("Topology"),
  transform: z.object({ scale: pairSchema, translate: pairSchema }),
  arcs: z.array(z.array(z.array(z.number()))),
  objects: z.object({
    countries: z.object({
      type: z.literal("GeometryCollection"),
      geometries: z.array(
        z.discriminatedUnion("type", [
          z.object({
            type: z.literal("Polygon"),
            arcs: z.array(z.array(z.number())),
            ...atlasGeometryFields,
          }),
          z.object({
            type: z.literal("MultiPolygon"),
            arcs: z.array(z.array(z.array(z.number()))),
            ...atlasGeometryFields,
          }),
        ]),
      ),
    }),
  }),
});

type Atlas = z.infer<typeof atlasSchema>;

type AtlasGeometry = Atlas["objects"]["countries"]["geometries"][number];

const atlas = atlasSchema.parse(JSON.parse(fs.readFileSync(atlasPath, "utf8")));
const codeByNumericCode = new Map(countries.map((country) => [country.ccn3, country.cca3]));
const centerByCode = new Map(records.map((record) => [record.code, record.center]));

function candidateCodes(geometry: AtlasGeometry): string[] {
  const named = CODES_BY_ATLAS_NAME.get(geometry.properties.name);

  if (named) return named;

  const code = geometry.id === undefined ? undefined : codeByNumericCode.get(geometry.id);

  return code ? [code, ...(OVERSEAS_CODES.get(code) ?? [])] : [];
}

function nearestCode(rings: ArcIndexes[], codes: string[]): string | undefined {
  const centroid = geoCentroid(feature(atlas, { type: "Polygon", arcs: rings }));

  const distances = codes.flatMap((code) => {
    const center = centerByCode.get(code);

    return center ? [{ code, distance: geoDistance(centroid, [center[0], center[1]]) }] : [];
  });

  return distances.sort((first, second) => first.distance - second.distance)[0]?.code;
}

function groupPolygonsByCode(): Map<string | undefined, ArcIndexes[][]> {
  const groups = new Map<string | undefined, ArcIndexes[][]>();

  for (const geometry of atlas.objects.countries.geometries) {
    const codes = candidateCodes(geometry);
    const polygons = geometry.type === "Polygon" ? [geometry.arcs] : geometry.arcs;

    for (const rings of polygons) {
      const code = nearestCode(rings, codes);

      groups.set(code, [...(groups.get(code) ?? []), rings]);
    }
  }

  return groups;
}

function buildCountryTopology() {
  const geometries = [...groupPolygonsByCode()]
    .sort(([first], [second]) => (first ?? "").localeCompare(second ?? ""))
    .map(([code, polygons]) => ({
      ...mergeArcs(
        atlas,
        polygons.map((arcs) => ({ type: "Polygon" as const, arcs })),
      ),
      id: code,
    }));

  const merged: Topology<{ countries: GeometryCollection }> = {
    type: "Topology",
    transform: atlas.transform,
    arcs: atlas.arcs,
    objects: { countries: { type: "GeometryCollection", geometries } },
  };

  const presimplified = presimplify(merged);
  const simplified = simplify(presimplified, quantile(presimplified, KEPT_POINT_SHARE));
  const { features } = feature(simplified, simplified.objects.countries);

  const countryCollection: FeatureCollection = {
    type: "FeatureCollection",
    features: features.map(({ id, geometry }) => ({
      type: "Feature",
      id,
      properties: null,
      geometry,
    })),
  };

  return topology({ countries: countryCollection }, TOPOLOGY_QUANTIZATION);
}

const outputs = [
  {
    relativePath: countriesRelativePath,
    source: `export const COUNTRY_RECORDS = ${JSON.stringify(records)} as const;\n`,
    summary: `${records.length} entries`,
  },
  {
    relativePath: topologyRelativePath,
    source: `import type { GeometryCollection, Topology } from "topojson-specification";\n\nexport const COUNTRY_TOPOLOGY: Topology<{ countries: GeometryCollection }> = ${JSON.stringify(buildCountryTopology())};\n`,
    summary: "the country outlines",
  },
];

function format(relativePath: string, source: string): string {
  const formatter = Bun.spawnSync(
    [path.join(repoRoot, "node_modules/.bin/oxfmt"), `--stdin-filepath=${relativePath}`],
    { cwd: repoRoot, stdin: Buffer.from(source) },
  );

  if (formatter.exitCode !== 0) {
    throw new Error(`oxfmt failed: ${formatter.stderr.toString()}`);
  }

  return formatter.stdout.toString();
}

const isCheck = process.argv.includes("--check");
let isOutOfDate = false;

for (const { relativePath, source, summary } of outputs) {
  const outputPath = path.join(repoRoot, relativePath);
  const formatted = format(relativePath, source);

  if (!isCheck) {
    fs.writeFileSync(outputPath, formatted);
    console.log(`Generated ${relativePath} with ${summary}.`);
  } else if (fs.existsSync(outputPath) && fs.readFileSync(outputPath, "utf8") === formatted) {
    console.log(`${relativePath} is up to date.`);
  } else {
    console.error(`${relativePath} is out of date. Run bun run gen:countries.`);
    isOutOfDate = true;
  }
}

if (isOutOfDate) process.exit(1);
