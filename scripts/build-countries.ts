import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import countries from "world-countries";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.join(__dirname, "../src/features/countries/countries.json");
const labelsOutputPath = path.join(__dirname, "../src/features/countries/country-labels.json");

interface CountryData {
  code: string;
  name: string;
  flag: string;
  continent: string;
  counted: boolean;
}

function mapRegionToContinent(
  region: string | undefined,
  subregion: string | undefined,
): string | undefined {
  if (region === "Americas") {
    if (subregion === "South America") {
      return "South America";
    }

    return "North America";
  }

  if (region === "Antarctic") {
    return "Antarctica";
  }

  if (region === "Africa") return "Africa";

  if (region === "Asia") return "Asia";

  if (region === "Europe") return "Europe";

  if (region === "Oceania") return "Oceania";

  return undefined;
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
  .map((country): CountryData => {
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
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

const emptyFlags = processed.filter((c) => !c.flag || c.flag.trim() === "");

if (emptyFlags.length > 0) {
  throw new Error(
    `Found ${emptyFlags.length} entries with empty flags: ${emptyFlags.map((c) => c.code).join(", ")}`,
  );
}

if (countedCount !== 195) {
  throw new Error(`Expected exactly 195 counted entries, got ${countedCount}`);
}

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
