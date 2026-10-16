import type { GeoJSONFeature } from "mapbox-gl";
import { ISO_PROPERTY } from "@/features/globe/map-style";

export function readTilesetFeature(feature: GeoJSONFeature) {
  const properties = feature.properties ?? {};

  return {
    code: String(properties[ISO_PROPERTY] ?? ""),
    name: String(properties.name_en ?? properties.name ?? "unknown"),
  };
}
