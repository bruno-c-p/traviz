import type { GeoJSONFeature } from "mapbox-gl";
import { z } from "zod";
import { ISO_PROPERTY } from "@/lib/mapStyle";

const tilesetPropertiesSchema = z.object({
  [ISO_PROPERTY]: z.string().optional(),
  name_en: z.string().optional(),
  name: z.string().optional(),
});

export function readTilesetFeature(feature: GeoJSONFeature) {
  const parsed = tilesetPropertiesSchema.safeParse(feature.properties);
  const properties = parsed.success ? parsed.data : {};

  return {
    code: properties[ISO_PROPERTY],
    name: properties.name_en ?? properties.name ?? "unknown",
  };
}
