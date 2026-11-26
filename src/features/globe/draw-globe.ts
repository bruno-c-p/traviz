import { geoDistance, geoStream } from "d3-geo";
import type { GeoStream } from "d3-geo";
import type { MultiLineString } from "geojson";
import type { Camera, LngLat } from "@/features/globe/globe-camera";
import {
  continentLabelOpacity,
  continentLabelSize,
  countryLabelSize,
  placeLabels,
  wrapWords,
} from "@/features/globe/globe-labels";
import type { Box } from "@/features/globe/globe-labels";
import { placeMarkers } from "@/features/globe/globe-markers";
import type { GlobeMarker, PlacedMarker } from "@/features/globe/globe-markers";
import { GLOBE_PLACES } from "@/features/globe/globe-places";
import { partVisibility } from "@/features/globe/globe-scene";
import type { GlobeScene, GlobeView } from "@/features/globe/globe-scene";
import type { GlobePalette } from "@/features/globe/globe-palette";
import type { Marks } from "@/features/marks";

const BORDER_WIDTHS: [number, number] = [0.6, 1.6];
const SELECTED_WIDTHS: [number, number] = [1.5, 3];
const MARKER_RADIUS = 4;
const MARKER_RING_WIDTH = 1.5;
const SELECTED_MARKER_RADIUS = 5;
const SELECTED_MARKER_RING_WIDTH = 2.5;
const MARKER_LABEL_GAP = SELECTED_MARKER_RADIUS + SELECTED_MARKER_RING_WIDTH;
const WIDTH_MAX_ZOOM = 6;
const HALO_SPREAD = 0.12;
const HAZE_START = 0.82;

const LABEL_LINE_HEIGHT = 1.1;
const LABEL_MAX_WIDTH_EMS = 6;
const LABEL_PADDING = 2;
const LABEL_HORIZON_SHARE = 0.85;
const LABEL_SIZE_STEPS_PER_PIXEL = 4;
const CONTINENT_LETTER_SPACING = 0.05;

const CONTINENTS: { name: string; center: LngLat }[] = [
  { name: "North America", center: [-100, 47] },
  { name: "South America", center: [-58, -15] },
  { name: "Europe", center: [15, 50] },
  { name: "Africa", center: [20, 5] },
  { name: "Asia", center: [90, 45] },
  { name: "Oceania", center: [135, -25] },
];

const COUNTRY_LABELS = GLOBE_PLACES.flatMap(({ code, center, label }) =>
  label ? [{ code, center, ...label }] : [],
).toSorted((first, second) => second.area - first.area);

export type GlobeFrame = {
  context: CanvasRenderingContext2D;
  view: GlobeView;
  camera: Camera;
  width: number;
  height: number;
  scene: GlobeScene;
  markers: GlobeMarker[];
  marks: Marks;
  selectedCode: string | null;
  selectedOutline: MultiLineString | null;
  fontFamily: string;
  labelLayouts: LabelLayouts;
  palette: GlobePalette;
};

type LabelStyle = { size: number; opacity: number; letterSpacing: number; halo: number };

type LabelLayout = { size: number; lines: string[]; halfWidth: number; halfHeight: number };

export type LabelLayouts = Map<string, LabelLayout>;

type LabelCandidate = { text: string; center: LngLat; style: LabelStyle; isBelowMarker: boolean };

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

function drawSphere({ context, view, width, height, palette }: GlobeFrame) {
  const center = view.projection.translate();
  const { radius } = view;
  const haloRadius = radius * (1 + HALO_SPREAD);

  context.fillStyle = palette.space;
  context.fillRect(0, 0, width, height);
  fillCircle(
    context,
    center,
    haloRadius,
    radialFade(context, center, [radius, haloRadius], [palette.halo, palette.clear]),
  );
  fillCircle(context, center, radius, palette.water);
}

type CountryPart = GlobeScene["countries"][number]["parts"][number];

type ColorGroup = { front: CountryPart[]; horizon: CountryPart[] };

function groupByColor({ scene, marks, view, palette }: GlobeFrame): Map<string, ColorGroup> {
  const groups = new Map<string, ColorGroup>();

  for (const country of scene.countries) {
    const state = country.code === null ? undefined : marks[country.code];
    const color = palette.states[state ?? "unmarked"];
    const group = groups.get(color) ?? { front: [], horizon: [] };

    for (const part of country.parts) {
      const visibility = partVisibility(part, view);

      if (visibility !== "hidden") group[visibility].push(part);
    }

    groups.set(color, group);
  }

  return groups;
}

type PathTarget = Pick<Path2D, "moveTo" | "lineTo" | "closePath">;

function pathStream(target: PathTarget): GeoStream {
  let isRing = false;
  let isLineStart = false;

  return {
    point: (x, y) => {
      if (isLineStart) target.moveTo(x, y);
      else target.lineTo(x, y);

      isLineStart = false;
    },
    lineStart: () => {
      isLineStart = true;
    },
    lineEnd: () => {
      if (isRing) target.closePath();
    },
    polygonStart: () => {
      isRing = true;
    },
    polygonEnd: () => {
      isRing = false;
    },
  };
}

function drawCountries(frame: GlobeFrame) {
  const { context, view, camera, selectedOutline, palette } = frame;
  const paths: Path2D[] = [];

  for (const [color, { front, horizon }] of groupByColor(frame)) {
    const colorPath = new Path2D();
    const clipped = view.projection.stream(pathStream(colorPath));

    for (const part of front) view.traceFront(colorPath, part.rings);

    for (const part of horizon) geoStream(part.area, clipped);

    context.fillStyle = color;
    context.fill(colorPath);
    paths.push(colorPath);
  }

  context.lineJoin = "round";
  context.lineCap = "round";
  context.strokeStyle = palette.border;
  context.lineWidth = widthAtZoom(camera.zoom, BORDER_WIDTHS);

  for (const colorPath of paths) context.stroke(colorPath);

  if (!selectedOutline) return;

  context.beginPath();
  geoStream(selectedOutline, view.projection.stream(pathStream(context)));
  context.strokeStyle = palette.selected;
  context.lineWidth = widthAtZoom(camera.zoom, SELECTED_WIDTHS);
  context.stroke();
}

function markerPath(placed: PlacedMarker[], radius: number): Path2D {
  const path = new Path2D();

  for (const { x, y } of placed) {
    path.moveTo(x + radius, y);
    path.arc(x, y, radius, 0, 2 * Math.PI);
  }

  return path;
}

function drawMarkerGroup(
  context: CanvasRenderingContext2D,
  placed: PlacedMarker[],
  [radius, ringWidth]: [number, number],
  [fill, ring]: [string, string],
) {
  const path = markerPath(placed, radius);

  context.strokeStyle = ring;
  context.lineWidth = ringWidth * 2;
  context.stroke(path);
  context.fillStyle = fill;
  context.fill(path);
}

function drawMarkers(
  { context, marks, selectedCode, palette }: GlobeFrame,
  placed: PlacedMarker[],
) {
  const markerColor = (code: string) => palette.states[marks[code] ?? "unmarked"];

  const groups = new Map<string, PlacedMarker[]>();
  let selected: PlacedMarker | undefined;

  for (const marker of placed) {
    if (marker.code === selectedCode) {
      selected = marker;
    } else {
      const color = markerColor(marker.code);
      const group = groups.get(color) ?? [];

      group.push(marker);
      groups.set(color, group);
    }
  }

  for (const [color, group] of groups) {
    drawMarkerGroup(
      context,
      group,
      [MARKER_RADIUS, MARKER_RING_WIDTH],
      [color, palette.markerRing],
    );
  }

  if (!selected) return;

  drawMarkerGroup(
    context,
    [selected],
    [SELECTED_MARKER_RADIUS, SELECTED_MARKER_RING_WIDTH],
    [markerColor(selected.code), palette.selected],
  );
}

function drawHaze({ context, view, palette }: GlobeFrame) {
  const center = view.projection.translate();
  const { radius } = view;

  fillCircle(
    context,
    center,
    radius,
    radialFade(context, center, [radius * HAZE_START, radius], [palette.clear, palette.haze]),
  );
}

function roundLabelSize(size: number): number {
  return Math.round(size * LABEL_SIZE_STEPS_PER_PIXEL) / LABEL_SIZE_STEPS_PER_PIXEL;
}

function labelCandidates(frame: GlobeFrame, markerCodes: Set<string>): LabelCandidate[] {
  const { zoom } = frame.camera;
  const continentOpacity = continentLabelOpacity(zoom);

  const continentStyle: LabelStyle = {
    size: roundLabelSize(continentLabelSize(zoom)),
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
          isBelowMarker: false,
        }))
      : []),
    ...COUNTRY_LABELS.map(({ code, name, center, area }) => ({
      text: name,
      center,
      style: {
        size: roundLabelSize(countryLabelSize(area, zoom)),
        opacity: 1,
        letterSpacing: 0,
        halo: 1.25,
      },
      isBelowMarker: markerCodes.has(code),
    })),
  ];
}

function setLabelFont(context: CanvasRenderingContext2D, fontFamily: string, style: LabelStyle) {
  context.font = `500 ${style.size}px ${fontFamily}`;
  context.letterSpacing = `${style.size * style.letterSpacing}px`;
}

function measureLabel(
  { context, fontFamily, labelLayouts }: GlobeFrame,
  text: string,
  style: LabelStyle,
): LabelLayout {
  const cached = labelLayouts.get(text);

  if (cached?.size === style.size) return cached;

  setLabelFont(context, fontFamily, style);

  const measure = (line: string) => context.measureText(line).width;
  const lines = wrapWords(text, measure, style.size * LABEL_MAX_WIDTH_EMS);

  const layout = {
    size: style.size,
    lines,
    halfWidth: Math.max(...lines.map(measure)) / 2 + LABEL_PADDING,
    halfHeight: (lines.length * style.size * LABEL_LINE_HEIGHT) / 2 + LABEL_PADDING,
  };

  labelLayouts.set(text, layout);

  return layout;
}

function layoutLabel(frame: GlobeFrame, candidate: LabelCandidate): Label | null {
  const { view, camera, width, height } = frame;
  const { style } = candidate;
  const point = view.projection(candidate.center);
  const angle = geoDistance(candidate.center, camera.center);

  if (!point || angle > view.horizon * LABEL_HORIZON_SHARE) return null;

  const { lines, halfWidth, halfHeight } = measureLabel(frame, candidate.text, style);
  const [x, pointY] = point;
  const y = candidate.isBelowMarker ? pointY + MARKER_LABEL_GAP + halfHeight : pointY;

  const box = {
    left: x - halfWidth,
    right: x + halfWidth,
    top: y - halfHeight,
    bottom: y + halfHeight,
  };

  if (box.left < 0 || box.top < 0 || box.right > width || box.bottom > height) return null;

  return { ...style, lines, x, y, box };
}

function drawLabels(frame: GlobeFrame, placed: PlacedMarker[]) {
  const { context, fontFamily, palette } = frame;
  const markerCodes = new Set(placed.map(({ code }) => code));

  const labels = placeLabels(
    labelCandidates(frame, markerCodes).flatMap((candidate) => layoutLabel(frame, candidate) ?? []),
  );

  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = palette.label;
  context.strokeStyle = palette.labelHalo;

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
  const placed = placeMarkers(frame.markers, frame.view);

  drawSphere(frame);
  drawCountries(frame);
  drawMarkers(frame, placed);
  drawHaze(frame);
  drawLabels(frame, placed);
}
