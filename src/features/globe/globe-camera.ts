export type LngLat = [longitude: number, latitude: number];

export type Camera = { center: LngLat; zoom: number };

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;

const MAX_LATITUDE = 85;
const MIN_PAN_LATITUDE_SCALE = 0.25;
const SCALE_MATCH_LATITUDE = Math.PI / 4;

export function globeScale(zoom: number): number {
  return (512 * 2 ** zoom) / (2 * Math.PI) / Math.cos(SCALE_MATCH_LATITUDE);
}

function wrapLongitude(longitude: number): number {
  return ((((longitude + 180) % 360) + 360) % 360) - 180;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function clampCamera({ center: [longitude, latitude], zoom }: Camera): Camera {
  return {
    center: [wrapLongitude(longitude), clamp(latitude, -MAX_LATITUDE, MAX_LATITUDE)],
    zoom: clamp(zoom, MIN_ZOOM, MAX_ZOOM),
  };
}

export function panCamera({ center: [longitude, latitude], zoom }: Camera, dx: number, dy: number) {
  const degreesPerPixel = 180 / (Math.PI * globeScale(zoom));
  const latitudeScale = Math.max(Math.cos((latitude * Math.PI) / 180), MIN_PAN_LATITUDE_SCALE);

  return clampCamera({
    center: [longitude - (dx * degreesPerPixel) / latitudeScale, latitude + dy * degreesPerPixel],
    zoom,
  });
}

export function easeInOutCubic(progress: number): number {
  return progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
}

export function easeOutCubic(progress: number): number {
  return 1 - (1 - progress) ** 3;
}
