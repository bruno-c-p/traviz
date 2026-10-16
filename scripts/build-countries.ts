import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import countries from "world-countries";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputRelativePath = "src/features/countries/countries.generated.ts";
const outputPath = path.join(repoRoot, outputRelativePath);

const COUNTED_OBSERVER_STATES = new Set(["PSE"]);
const EXPECTED_SOVEREIGN_COUNT = 195;
const LABEL_MIN_TERRITORY_AREA = 100000;
const FALLBACK_FLAG = "🏳️";

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
  .sort((first, second) => first.name.localeCompare(second.name));

const sovereignCount = records.filter((record) => record.kind === "sovereign").length;

if (sovereignCount !== EXPECTED_SOVEREIGN_COUNT) {
  throw new Error(`Expected ${EXPECTED_SOVEREIGN_COUNT} sovereign entries, got ${sovereignCount}`);
}

const source = `export const COUNTRY_RECORDS = ${JSON.stringify(records)} as const;\n`;

const formatter = Bun.spawnSync(
  [path.join(repoRoot, "node_modules/.bin/oxfmt"), `--stdin-filepath=${outputRelativePath}`],
  { cwd: repoRoot, stdin: Buffer.from(source) },
);

if (formatter.exitCode !== 0) {
  throw new Error(`oxfmt failed: ${formatter.stderr.toString()}`);
}

const formatted = formatter.stdout.toString();

if (process.argv.includes("--check")) {
  const current = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, "utf8") : "";

  if (current !== formatted) {
    console.error(`${outputRelativePath} is out of date. Run bun run gen:countries.`);
    process.exit(1);
  }

  console.log(`${outputRelativePath} is up to date.`);
} else {
  fs.writeFileSync(outputPath, formatted);
  console.log(`Generated ${outputRelativePath} with ${records.length} entries.`);
}
