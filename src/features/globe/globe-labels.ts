export type Box = { left: number; top: number; right: number; bottom: number };

const COUNTRY_SIZE_ZOOMS = [1, 9] as const;
const COUNTRY_SIZE_EASING = [0.2, 0, 0.7, 1] as const;
const CONTINENT_SIZE_ZOOMS = [0, 2.5] as const;
const CONTINENT_SIZES = [10, 15] as const;
const CONTINENT_SIZE_BASE = 0.5;
const CONTINENT_OPACITY_ZOOMS = [0, 1.5, 2.5] as const;
const CONTINENT_OPACITIES = [0.8, 0.5] as const;
const BEZIER_STEPS = 24;

function countrySizes(area: number): [small: number, large: number] {
  if (area >= 1_000_000) return [11, 22];

  if (area >= 200_000) return [9, 19];

  return [8, 17];
}

function bezierAxis(progress: number, first: number, second: number): number {
  const rest = 1 - progress;

  return (
    3 * rest * rest * progress * first + 3 * rest * progress * progress * second + progress ** 3
  );
}

function easeCubicBezier(x: number): number {
  const [x1, y1, x2, y2] = COUNTRY_SIZE_EASING;
  let low = 0;
  let high = 1;

  for (let step = 0; step < BEZIER_STEPS; step++) {
    const middle = (low + high) / 2;

    if (bezierAxis(middle, x1, x2) < x) low = middle;
    else high = middle;
  }

  return bezierAxis((low + high) / 2, y1, y2);
}

function progressBetween(value: number, [start, end]: readonly [number, number]): number {
  return Math.min(Math.max((value - start) / (end - start), 0), 1);
}

export function countryLabelSize(area: number, zoom: number): number {
  const [small, large] = countrySizes(area);

  return small + (large - small) * easeCubicBezier(progressBetween(zoom, COUNTRY_SIZE_ZOOMS));
}

export function continentLabelSize(zoom: number): number {
  const [start, end] = CONTINENT_SIZE_ZOOMS;
  const progress = progressBetween(zoom, CONTINENT_SIZE_ZOOMS) * (end - start);
  const eased = (CONTINENT_SIZE_BASE ** progress - 1) / (CONTINENT_SIZE_BASE ** (end - start) - 1);
  const [small, large] = CONTINENT_SIZES;

  return small + (large - small) * eased;
}

export function continentLabelOpacity(zoom: number): number {
  const [start, middle, end] = CONTINENT_OPACITY_ZOOMS;
  const [high, low] = CONTINENT_OPACITIES;

  if (zoom < middle) return high + (low - high) * progressBetween(zoom, [start, middle]);

  return low * (1 - progressBetween(zoom, [middle, end]));
}

export function wrapWords(
  text: string,
  measure: (line: string) => number,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let line = "";

  for (const word of text.split(" ")) {
    const candidate = line ? `${line} ${word}` : word;

    if (line && measure(candidate) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }

  return line ? [...lines, line] : lines;
}

function overlaps(first: Box, second: Box): boolean {
  return (
    first.left < second.right &&
    second.left < first.right &&
    first.top < second.bottom &&
    second.top < first.bottom
  );
}

export function placeLabels<T extends { box: Box }>(candidates: Iterable<T>): T[] {
  const placed: T[] = [];

  for (const candidate of candidates) {
    if (!placed.some((label) => overlaps(label.box, candidate.box))) placed.push(candidate);
  }

  return placed;
}
