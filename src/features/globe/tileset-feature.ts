import type { GeoJSONFeature } from "mapbox-gl";

export const ISO_PROPERTY = "iso_3166_1_alpha_3";

const DATASET_CODE_BY_TILESET_CODE = new Map([["XKS", "UNK"]]);

export function tilesetCodes(datasetCode: string): string[] {
  const aliases = [...DATASET_CODE_BY_TILESET_CODE].flatMap(([tilesetCode, aliasedCode]) =>
    aliasedCode === datasetCode ? [tilesetCode] : [],
  );

  return [datasetCode, ...aliases];
}

export type TilesetFeature = Pick<GeoJSONFeature, "properties">;

export function readTilesetFeature(feature: TilesetFeature) {
  const properties = feature.properties ?? {};
  const tilesetCode = String(properties[ISO_PROPERTY] ?? "");

  return {
    code: DATASET_CODE_BY_TILESET_CODE.get(tilesetCode) ?? tilesetCode,
    name: String(properties.name_en ?? properties.name ?? "unknown"),
  };
}
