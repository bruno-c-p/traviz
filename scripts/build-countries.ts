/**
 * Build script: Extract country metadata from world-countries package.
 *
 * This generates a slim JSON file with only country name, code, flag, continent, and count status.
 * The geometry comes from Mapbox at runtime; we do NOT extract GeoJSON.
 *
 * Note: The generated list is ISO 3166-1 official entries only. The Mapbox `country-boundaries-v1`
 * tileset may contain codes not present here. Kosovo (XKX/XK) is the known case — it has no official
 * ISO code, so it does not appear in world-countries and will be unmatched at runtime.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import countries from "world-countries";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.join(__dirname, "../src/data/countries.json");
const labelsOutputPath = path.join(__dirname, "../src/data/country-labels.json");

interface CountryData {
  code: string;
  name: string;
  flag: string;
  continent: string;
  counted: boolean;
}

function mapRegionToContinent(region: string | undefined, subregion: string | undefined): string {
  if (region === "Americas") {
    if (subregion === "South America") {
      return "South America";
    }
    // Caribbean, Central America, North America, Northern America -> North America
    return "North America";
  }

  if (region === "Antarctic") {
    return "Antarctica";
  }

  if (region === "Africa") return "Africa";
  if (region === "Asia") return "Asia";
  if (region === "Europe") return "Europe";
  if (region === "Oceania") return "Oceania";

  return undefined as any;
}

const continents = [
  "Africa",
  "Asia",
  "Europe",
  "North America",
  "South America",
  "Oceania",
  "Antarctica",
];
const continentCounts: Record<string, number> = Object.fromEntries(continents.map((c) => [c, 0]));
let countedCount = 0;
const flagFallbacks: string[] = [];

const processed = countries
  .map((country) => {
    const continent = mapRegionToContinent(country.region, country.subregion);

    if (!continent) {
      throw new Error(
        `Unmapped continent for ${country.name.common}: region="${country.region}", subregion="${country.subregion}"`,
      );
    }

    const counted = country.unMember || country.cca3 === "PSE";

    if (counted) {
      countedCount++;
      continentCounts[continent]++;
    }

    // Apply fallback for missing/empty flags (e.g., BES, unrecognized territories)
    let flag = country.flag;
    if (!flag || flag.trim() === "") {
      flag = "🏳️";
      flagFallbacks.push(country.cca3);
    }

    return {
      code: country.cca3,
      name: country.name.common,
      flag,
      continent,
      counted,
    } as CountryData;
  })
  .sort((a, b) => a.name.localeCompare(b.name));

// Verify no empty flags remain
const emptyFlags = processed.filter((c) => !c.flag || c.flag.trim() === "");
if (emptyFlags.length > 0) {
  throw new Error(
    `Found ${emptyFlags.length} entries with empty flags: ${emptyFlags.map((c) => c.code).join(", ")}`,
  );
}

// Verify exactly 195 counted entries.
// Note: world-countries marks Vatican City (VAT) as unMember: true despite it being a permanent UN observer
// (not a full member). This means VAT arrives via the unMember set, not as an explicit observer addition.
// We add PSE explicitly because it is marked unMember: false in world-countries.
if (countedCount !== 195) {
  throw new Error(`Expected exactly 195 counted entries, got ${countedCount}`);
}

// Verify VAT and PSE are both in the counted set
const vat = processed.find((c) => c.code === "VAT");
const pse = processed.find((c) => c.code === "PSE");
if (!vat) {
  throw new Error("Vatican City (VAT) not found in data");
}
if (!vat.counted) {
  throw new Error("Vatican City (VAT) must have counted=true");
}
if (!pse) {
  throw new Error("Palestine (PSE) not found in data");
}
if (!pse.counted) {
  throw new Error("Palestine (PSE) must have counted=true");
}

fs.writeFileSync(outputPath, JSON.stringify(processed, null, 2) + "\n");

const LABEL_MIN_TERRITORY_AREA = 100000;

const labels = countries
  .filter((country) => country.independent || country.area >= LABEL_MIN_TERRITORY_AREA)
  .map((country) => ({
    name: country.name.common,
    coordinates: [country.latlng[1], country.latlng[0]],
    area: country.area,
  }))
  .sort((a, b) => b.area - a.area);
fs.writeFileSync(labelsOutputPath, JSON.stringify(labels) + "\n");

const totalRows = processed.length;
const fileSize = fs.statSync(outputPath).size;

console.log(`Generated ${outputPath}`);
console.log(`Total rows: ${totalRows}`);
console.log(`Counted (counted=true): ${countedCount}`);
console.log(`Per-continent breakdown:`);
continents.forEach((c) => {
  console.log(`  ${c}: ${continentCounts[c]}`);
});
console.log(`File size: ${fileSize} bytes (~${Math.round(fileSize / 1024)}KB)`);
if (flagFallbacks.length > 0) {
  console.log(`Flag fallbacks applied: ${flagFallbacks.join(", ")}`);
}
