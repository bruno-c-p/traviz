import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import subsetFont from "subset-font";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const sourcePath = fileURLToPath(
  import.meta.resolve("@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2"),
);

const fontFileName = "geist-mono-subset.woff2";
const fontRelativePath = `src/shared/styles/${fontFileName}`;
const cssRelativePath = "src/shared/styles/geist-mono.generated.css";

const FONT_FAMILY = "Geist Mono Variable";
const MIN_WEIGHT = 400;
const MAX_WEIGHT = 700;
const PRINTABLE_ASCII = { first: 0x20, last: 0x7e };
const MIDDLE_DOT = { first: 0xb7, last: 0xb7 };
const CODE_POINT_RANGES = [PRINTABLE_ASCII, MIDDLE_DOT];

function hex(codePoint: number): string {
  return codePoint.toString(16).toUpperCase().padStart(4, "0");
}

const subsetText = CODE_POINT_RANGES.flatMap(({ first, last }) =>
  Array.from({ length: last - first + 1 }, (_, offset) => String.fromCodePoint(first + offset)),
).join("");

const unicodeRange = CODE_POINT_RANGES.map(({ first, last }) =>
  first === last ? `U+${hex(first)}` : `U+${hex(first)}-${hex(last)}`,
).join(", ");

const font = await subsetFont(fs.readFileSync(sourcePath), subsetText, {
  targetFormat: "woff2",
  variationAxes: { wght: { min: MIN_WEIGHT, max: MAX_WEIGHT } },
});

const css = `@font-face {
  font-family: "${FONT_FAMILY}";
  font-style: normal;
  font-display: swap;
  font-weight: ${MIN_WEIGHT} ${MAX_WEIGHT};
  src: url("./${fontFileName}") format("woff2-variations");
  unicode-range: ${unicodeRange};
}
`;

const outputs = [
  {
    relativePath: fontRelativePath,
    content: font,
    summary: `${font.length} bytes, ${subsetText.length} characters, weights ${MIN_WEIGHT} to ${MAX_WEIGHT}`,
  },
  { relativePath: cssRelativePath, content: Buffer.from(css), summary: unicodeRange },
];

const isCheck = process.argv.includes("--check");
let isOutOfDate = false;

for (const { relativePath, content, summary } of outputs) {
  const outputPath = path.join(repoRoot, relativePath);

  if (!isCheck) {
    fs.writeFileSync(outputPath, content);
    console.log(`Generated ${relativePath}: ${summary}.`);
  } else if (fs.existsSync(outputPath) && fs.readFileSync(outputPath).equals(content)) {
    console.log(`${relativePath} is up to date.`);
  } else {
    console.error(`${relativePath} is out of date. Run bun run gen:fonts.`);
    isOutOfDate = true;
  }
}

if (isOutOfDate) process.exit(1);
