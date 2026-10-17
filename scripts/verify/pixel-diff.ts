import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { launchBrowser } from "@/shared/testing/verify/browser";

const [before, after] = process.argv.slice(2);

if (!before || !after) {
  console.error("usage: bun run verify:pixel-diff <before dir> <after dir>");
  process.exit(1);
}

const diffSchema = z.object({
  size: z.string().optional(),
  differentPixels: z.number(),
  maxChannelDelta: z.number(),
});

const compareSource = `async ([first, second]) => {
  const load = (base64) => new Promise((resolve) => { const image = new Image(); image.onload = () => resolve(image); image.src = "data:image/png;base64," + base64; });
  const [left, right] = [await load(first), await load(second)];
  if (left.width !== right.width || left.height !== right.height)
    return { size: left.width + "x" + left.height + " vs " + right.width + "x" + right.height, differentPixels: -1, maxChannelDelta: -1 };
  const pixels = (image) => { const canvas = document.createElement("canvas"); canvas.width = image.width; canvas.height = image.height; const context = canvas.getContext("2d"); context.drawImage(image, 0, 0); return context.getImageData(0, 0, image.width, image.height).data; };
  const [a, b] = [pixels(left), pixels(right)];
  let differentPixels = 0, maxChannelDelta = 0;
  for (let index = 0; index < a.length; index += 4) {
    const delta = Math.max(Math.abs(a[index] - b[index]), Math.abs(a[index + 1] - b[index + 1]), Math.abs(a[index + 2] - b[index + 2]), Math.abs(a[index + 3] - b[index + 3]));
    if (delta > 0) { differentPixels++; maxChannelDelta = Math.max(maxChannelDelta, delta); }
  }
  return { differentPixels, maxChannelDelta };
}`;

const pngs = (directory: string) => readdirSync(directory).filter((name) => name.endsWith(".png"));
const files = [...new Set([...pngs(before), ...pngs(after)])].toSorted();

if (files.length === 0) {
  console.error(`No PNG files in ${before} or ${after}.`);
  process.exit(1);
}

const browser = await launchBrowser();
const page = await browser.newPage();
let differs = false;

for (const file of files) {
  const missing = [before, after].find((directory) => !existsSync(join(directory, file)));

  if (missing) {
    differs = true;
    console.log(`${file}: missing from ${missing}`);
    continue;
  }

  const images = [before, after].map((directory) =>
    readFileSync(join(directory, file)).toString("base64"),
  );

  const result = diffSchema.parse(
    await page.evaluate(`(${compareSource})(${JSON.stringify(images)})`),
  );

  differs ||= result.differentPixels !== 0;
  console.log(
    result.size
      ? `${file}: size differs, ${result.size}`
      : `${file}: ${result.differentPixels} pixels differ, max channel delta ${result.maxChannelDelta}`,
  );
}

await browser.close();

if (differs) process.exitCode = 1;
