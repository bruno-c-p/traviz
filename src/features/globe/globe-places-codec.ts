const FIELD_SEPARATOR = "|";
const PLACE_SEPARATOR = ";";

export type GlobePlace = {
  code: string;
  center: [longitude: number, latitude: number];
  label: { name: string; area: number } | null;
};

export type GlobePlaceSource = {
  code: string;
  name: string;
  center: readonly [longitude: number, latitude: number];
  area: number;
  hasGlobeLabel: boolean;
};

function packPlace({ code, name, center, area, hasGlobeLabel }: GlobePlaceSource): string {
  const fields = [code, ...center, ...(hasGlobeLabel ? [area, name] : [])].map(String);

  if (fields.some((field) => field.includes(FIELD_SEPARATOR) || field.includes(PLACE_SEPARATOR))) {
    throw new Error(`${code} holds a separator of the packed globe places`);
  }

  return fields.join(FIELD_SEPARATOR);
}

export function packGlobePlaces(sources: readonly GlobePlaceSource[]): string {
  return sources.map(packPlace).join(PLACE_SEPARATOR);
}

function unpackLabel(area: string | undefined, name: string | undefined): GlobePlace["label"] {
  if (area === undefined || name === undefined) return null;

  return { name, area: Number(area) };
}

export function unpackGlobePlaces(packed: string): GlobePlace[] {
  return packed.split(PLACE_SEPARATOR).flatMap((text) => {
    const [code, longitude, latitude, area, name] = text.split(FIELD_SEPARATOR);

    if (code === undefined || longitude === undefined || latitude === undefined) return [];

    return [
      {
        code,
        center: [Number(longitude), Number(latitude)],
        label: unpackLabel(area, name),
      },
    ];
  });
}
