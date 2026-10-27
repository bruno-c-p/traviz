import { geoDistance, geoPath } from "d3-geo";
import type { GeoContext } from "d3-geo";
import type { MultiLineString } from "geojson";
import { countries } from "@/features/countries";
import type { Camera, LngLat } from "@/features/globe/globe-camera";
import {
  continentLabelOpacity,
  continentLabelSize,
  countryLabelSize,
  placeLabels,
  wrapWords,
} from "@/features/globe/globe-labels";
import type { Box } from "@/features/globe/globe-labels";
import { partVisibility } from "@/features/globe/globe-scene";
import type { GlobeScene, GlobeView } from "@/features/globe/globe-scene";
import { STATE_COLORS } from "@/features/marks";
import type { Marks } from "@/features/marks";

const SPACE_COLOR = "#f4f6f1";
const WATER_COLOR = "#d3d9cd";
const BORDER_COLOR = "rgba(255, 255, 255, 0.9)";
const SELECTED_COLOR = "#0e0f0c";
const LABEL_COLOR = "#5e615c";
const LABEL_HALO_COLOR = "#ffffff";
const HALO_COLOR = "rgba(255, 255, 255, 0.85)";
const HAZE_COLOR = "rgba(255, 255, 255, 0.35)";
const CLEAR_WHITE = "rgba(255, 255, 255, 0)";

const BORDER_WIDTHS: [number, number] = [0.6, 1.6];
const SELECTED_WIDTHS: [number, number] = [1.5, 3];
const WIDTH_MAX_ZOOM = 6;
const HALO_SPREAD = 0.12;
const HAZE_START = 0.82;

const LABEL_LINE_HEIGHT = 1.1;
const LABEL_MAX_WIDTH_EMS = 6;
const LABEL_PADDING = 2;
const LABEL_HORIZON_SHARE = 0.85;
const CONTINENT_LETTER_SPACING = 0.05;

const CONTINENTS: { name: string; center: LngLat }[] = [
  { name: "North America", center: [-100, 47] },
  { name: "South America", center: [-58, -15] },
  { name: "Europe", center: [15, 50] },
  { name: "Africa", center: [20, 5] },
  { name: "Asia", center: [90, 45] },
  { name: "Oceania", center: [135, -25] },
];

const COUNTRY_LABELS = countries
  .filter((country) => country.hasGlobeLabel)
  .toSorted((first, second) => second.area - first.area);

export type GlobeFrame = {
  context: CanvasRenderingContext2D;
  view: GlobeView;
  camera: Camera;
  width: number;
  height: number;
  scene: GlobeScene;
  marks: Marks;
  selectedOutline: MultiLineString | null;
  fontFamily: string;
};

type LabelStyle = { size: number; opacity: number; letterSpacing: number; halo: number };

type Label = LabelStyle & { lines: string[]; x: number; y: number; box: Box };

function widthAtZoom(zoom: number, [atLowest, atHighest]: [number, number]): number {
  return atLowest + (atHighest - atLowest) * Math.min(Math.max(zoom / WIDTH_MAX_ZOOM, 0), 1);
}

function fillCircle(
  context: CanvasRenderingContext2D,
  [x, y]: [number, number],
  radius: number,
  fill: string | CanvasGradient,
) {
  context.beginPath();
  context.arc(x, y, radius, 0, 2 * Math.PI);
  context.fillStyle = fill;
  context.fill();
}

function radialFade(
  context: CanvasRenderingContext2D,
  [x, y]: [number, number],
  [innerRadius, outerRadius]: [number, number],
  [innerColor, outerColor]: [string, string],
) {
  const gradient = context.createRadialGradient(x, y, innerRadius, x, y, outerRadius);

  gradient.addColorStop(0, innerColor);
  gradient.addColorStop(1, outerColor);

  return gradient;
}

function drawSphere({ context, view, width, height }: GlobeFrame) {
  const center = view.projection.translate();
  const { radius } = view;
  const haloRadius = radius * (1 + HALO_SPREAD);

  context.fillStyle = SPACE_COLOR;
  context.fillRect(0, 0, width, height);
  fillCircle(
    context,
    center,
    haloRadius,
    radialFade(context, center, [radius, haloRadius], [HALO_COLOR, CLEAR_WHITE]),
  );
  fillCircle(context, center, radius, WATER_COLOR);
}

type CountryPart = GlobeScene["countries"][number]["parts"][number];

type ColorGroup = { front: CountryPart[]; horizon: CountryPart[] };

function groupByColor({ scene, marks, view }: GlobeFrame): Map<string, ColorGroup> {
  const groups = new Map<string, ColorGroup>();

  for (const country of scene.countries) {
    const state = country.code === null ? undefined : marks[country.code];
    const color = STATE_COLORS[state ?? "unmarked"];
    const group = groups.get(color) ?? { front: [], horizon: [] };

    for (const part of country.parts) {
      const visibility = partVisibility(part, view);

      if (visibility !== "hidden") group[visibility].push(part);
    }

    groups.set(color, group);
  }

  return groups;
}

function pathContext(path: Path2D): GeoContext {
  return {
    beginPath: () => undefined,
    moveTo: (x, y) => path.moveTo(x, y),
    lineTo: (x, y) => path.lineTo(x, y),
    closePath: () => path.closePath(),
    arc: (x, y, radius, startAngle, endAngle) => path.arc(x, y, radius, startAngle, endAngle),
  };
}

function drawCountries(frame: GlobeFrame) {
  const { context, view, camera, selectedOutline } = frame;
  const paths: Path2D[] = [];

  for (const [color, { front, horizon }] of groupByColor(frame)) {
    const colorPath = new Path2D();
    const projectClipped = geoPath(view.projection, pathContext(colorPath));

    for (const part of front) view.traceFront(colorPath, part.rings);

    for (const part of horizon) projectClipped(part.area);

    context.fillStyle = color;
    context.fill(colorPath);
    paths.push(colorPath);
  }

  context.lineJoin = "round";
  context.lineCap = "round";
  context.strokeStyle = BORDER_COLOR;
  context.lineWidth = widthAtZoom(camera.zoom, BORDER_WIDTHS);

  for (const colorPath of paths) context.stroke(colorPath);

  if (!selectedOutline) return;

  context.beginPath();
  geoPath(view.projection, context)(selectedOutline);
  context.strokeStyle = SELECTED_COLOR;
  context.lineWidth = widthAtZoom(camera.zoom, SELECTED_WIDTHS);
  context.stroke();
}

function drawHaze({ context, view }: GlobeFrame) {
  const center = view.projection.translate();
  const { radius } = view;

  fillCircle(
    context,
    center,
    radius,
    radialFade(context, center, [radius * HAZE_START, radius], [CLEAR_WHITE, HAZE_COLOR]),
  );
}

function labelCandidates(frame: GlobeFrame) {
  const { zoom } = frame.camera;
  const continentOpacity = continentLabelOpacity(zoom);

  const continentStyle: LabelStyle = {
    size: continentLabelSize(zoom),
    opacity: continentOpacity,
    letterSpacing: CONTINENT_LETTER_SPACING,
    halo: 1.5,
  };

  return [
    ...(continentOpacity > 0
      ? CONTINENTS.map(({ name, center }) => ({
          text: name.toUpperCase(),
          center,
          style: continentStyle,
        }))
      : []),
    ...COUNTRY_LABELS.map(({ name, center, area }) => ({
      text: name,
      center: [center[0], center[1]] satisfies LngLat,
      style: { size: countryLabelSize(area, zoom), opacity: 1, letterSpacing: 0, halo: 1.25 },
    })),
  ];
}

function setLabelFont(context: CanvasRenderingContext2D, fontFamily: string, style: LabelStyle) {
  context.font = `500 ${style.size}px ${fontFamily}`;
  context.letterSpacing = `${style.size * style.letterSpacing}px`;
}

function layoutLabel(
  frame: GlobeFrame,
  candidate: { text: string; center: LngLat; style: LabelStyle },
): Label | null {
  const { context, view, camera, width, height, fontFamily } = frame;
  const { style } = candidate;
  const point = view.projection(candidate.center);
  const angle = geoDistance(candidate.center, camera.center);

  if (!point || angle > view.horizon * LABEL_HORIZON_SHARE) return null;

  const [x, y] = point;

  setLabelFont(context, fontFamily, style);

  const measure = (line: string) => context.measureText(line).width;
  const lines = wrapWords(candidate.text, measure, style.size * LABEL_MAX_WIDTH_EMS);
  const halfWidth = Math.max(...lines.map(measure)) / 2 + LABEL_PADDING;
  const halfHeight = (lines.length * style.size * LABEL_LINE_HEIGHT) / 2 + LABEL_PADDING;

  const box = {
    left: x - halfWidth,
    right: x + halfWidth,
    top: y - halfHeight,
    bottom: y + halfHeight,
  };

  if (box.left < 0 || box.top < 0 || box.right > width || box.bottom > height) return null;

  return { ...style, lines, x, y, box };
}

function drawLabels(frame: GlobeFrame) {
  const { context, fontFamily } = frame;

  const labels = placeLabels(
    labelCandidates(frame).flatMap((candidate) => layoutLabel(frame, candidate) ?? []),
  );

  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = LABEL_COLOR;
  context.strokeStyle = LABEL_HALO_COLOR;

  for (const label of labels) {
    const lineHeight = label.size * LABEL_LINE_HEIGHT;
    const top = label.y - ((label.lines.length - 1) * lineHeight) / 2;

    setLabelFont(context, fontFamily, label);
    context.globalAlpha = label.opacity;
    context.lineWidth = label.halo * 2;

    label.lines.forEach((line, index) => {
      context.strokeText(line, label.x, top + index * lineHeight);
      context.fillText(line, label.x, top + index * lineHeight);
    });
  }

  context.globalAlpha = 1;
  context.letterSpacing = "0px";
}

export function drawGlobe(frame: GlobeFrame) {
  drawSphere(frame);
  drawCountries(frame);
  drawHaze(frame);
  drawLabels(frame);
}
