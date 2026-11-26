import type { LngLat } from "@/features/globe/globe-camera";
import { unpackGlobePlaces } from "@/features/globe/globe-places-codec";
import type { GlobePlace } from "@/features/globe/globe-places-codec";
import { PACKED_GLOBE_PLACES } from "@/features/globe/globe-places.generated";

export const GLOBE_PLACES: readonly GlobePlace[] = unpackGlobePlaces(PACKED_GLOBE_PLACES);

const CENTERS_BY_CODE: ReadonlyMap<string, GlobePlace["center"]> = new Map(
  GLOBE_PLACES.map(({ code, center }) => [code, center]),
);

export function placeCenter(code: string): LngLat | null {
  const center = CENTERS_BY_CODE.get(code);

  return center ? [center[0], center[1]] : null;
}
