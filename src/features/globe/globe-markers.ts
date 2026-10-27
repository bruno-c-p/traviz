import { geoArea } from "d3-geo";
import { countries } from "@/features/countries";
import type { LngLat } from "@/features/globe/globe-camera";
import type { Point } from "@/features/globe/globe-gestures";
import { unitVector } from "@/features/globe/globe-scene";
import type { GlobeScene, GlobeView, Vector } from "@/features/globe/globe-scene";

const MIN_OUTLINE_PIXELS = 8;
const TAP_RADIUS_PIXELS = 12;

export type GlobeMarker = { code: string; center: LngLat; vector: Vector; size: number };

export type PlacedMarker = { code: string; x: number; y: number };

export function buildMarkers(scene: GlobeScene): GlobeMarker[] {
  const areas = new Map<string, number>();

  for (const { code, feature } of scene.countries) {
    if (code !== null) areas.set(code, (areas.get(code) ?? 0) + geoArea(feature));
  }

  return countries.map(({ code, center: [longitude, latitude] }) => ({
    code,
    center: [longitude, latitude],
    vector: unitVector([longitude, latitude]),
    size: Math.sqrt(areas.get(code) ?? 0),
  }));
}

export function placeMarkers(markers: GlobeMarker[], view: GlobeView): PlacedMarker[] {
  const maxSize = MIN_OUTLINE_PIXELS / view.scale;
  const minAlong = Math.cos(view.horizon);
  const [directionX, directionY, directionZ] = view.direction;

  return markers.flatMap(({ code, center, vector: [x, y, z], size }) => {
    if (size >= maxSize || x * directionX + y * directionY + z * directionZ <= minAlong) return [];

    const point = view.projection(center);

    return point ? [{ code, x: point[0], y: point[1] }] : [];
  });
}

export function markerAt(placed: PlacedMarker[], point: Point): string | null {
  let nearest: string | null = null;
  let nearestDistance = TAP_RADIUS_PIXELS;

  for (const { code, x, y } of placed) {
    const distance = Math.hypot(x - point.x, y - point.y);

    if (distance <= nearestDistance) {
      nearest = code;
      nearestDistance = distance;
    }
  }

  return nearest;
}
