import { geoContains, geoProjection } from "d3-geo";
import type { GeoProjection, GeoRawProjection } from "d3-geo";
import type { Feature, MultiLineString, Position } from "geojson";
import { globeScale } from "@/features/globe/globe-camera";
import type { Camera, LngLat } from "@/features/globe/globe-camera";
import { unpackTopology } from "@/features/globe/topology-codec";
import type { PackedTopology } from "@/features/globe/topology-codec";

const DEGREES = 180 / Math.PI;

export type Vector = [x: number, y: number, z: number];

type Cap = { vector: Vector; radius: number };

type CountryPart = { area: Feature; rings: Float64Array[]; cap: Cap };

type GlobeCountry = {
  code: string | null;
  feature: Feature;
  outline: MultiLineString;
  parts: CountryPart[];
};

export type GlobeScene = { countries: GlobeCountry[] };

export function unitVector([longitude, latitude]: Position): Vector {
  const cosPhi = Math.cos(latitude / DEGREES);

  return [
    cosPhi * Math.cos(longitude / DEGREES),
    cosPhi * Math.sin(longitude / DEGREES),
    Math.sin(latitude / DEGREES),
  ];
}

function unitVectors(rings: Position[][]): Float64Array[] {
  return rings.map((ring) => Float64Array.from(ring.flatMap(unitVector)));
}

function boundingCap(ring: Float64Array): Cap {
  let sumX = 0;
  let sumY = 0;
  let sumZ = 0;

  for (let index = 0; index < ring.length; index += 3) {
    sumX += ring[index];
    sumY += ring[index + 1];
    sumZ += ring[index + 2];
  }

  const length = Math.hypot(sumX, sumY, sumZ);
  const vector: Vector = length > 0 ? [sumX / length, sumY / length, sumZ / length] : [0, 0, 1];
  let minCos = 1;

  for (let index = 0; index < ring.length; index += 3) {
    minCos = Math.min(
      minCos,
      ring[index] * vector[0] + ring[index + 1] * vector[1] + ring[index + 2] * vector[2],
    );
  }

  return { vector, radius: length > 0 ? Math.acos(Math.max(minCos, -1)) : Math.PI };
}

function countryPart(rings: Position[][]): CountryPart {
  const vectors = unitVectors(rings);

  return {
    area: { type: "Feature", properties: null, geometry: { type: "Polygon", coordinates: rings } },
    rings: vectors,
    cap: boundingCap(vectors[0] ?? new Float64Array()),
  };
}

export function buildScene(topology: PackedTopology): GlobeScene {
  return {
    countries: unpackTopology(topology).map(({ code, polygons }) => {
      const area: Feature = {
        type: "Feature",
        properties: null,
        geometry: { type: "MultiPolygon", coordinates: polygons },
      };

      return {
        code,
        feature: area,
        outline: { type: "MultiLineString", coordinates: polygons.flat() },
        parts: polygons.map(countryPart),
      };
    }),
  };
}

const CAMERA_DISTANCE_PER_HEIGHT = 1.5;

type PathSink = Pick<Path2D, "moveTo" | "lineTo">;

export type GlobeView = {
  projection: GeoProjection;
  traceFront: (sink: PathSink, rings: Float64Array[]) => void;
  direction: Vector;
  scale: number;
  radius: number;
  horizon: number;
};

function perspectiveRaw(distance: number): GeoRawProjection {
  const forward = (lambda: number, phi: number): [number, number] => {
    const cosPhi = Math.cos(phi);
    const scale = (distance - 1) / (distance - cosPhi * Math.cos(lambda));

    return [scale * cosPhi * Math.sin(lambda), scale * Math.sin(phi)];
  };

  forward.invert = (x: number, y: number): [number, number] => {
    const rhoSquared = x * x + y * y;
    const rho = Math.sqrt(rhoSquared);

    const sinC =
      (distance - Math.sqrt(1 - (rhoSquared * (distance + 1)) / (distance - 1))) /
      ((distance - 1) / rho + rho / (distance - 1));

    return [
      Math.atan2(x * sinC, rho * Math.sqrt(1 - sinC * sinC)),
      rho ? Math.asin((y * sinC) / rho) : 0,
    ];
  };

  return forward;
}

function frontTracer(
  distance: number,
  scale: number,
  [centerX, centerY]: [number, number],
  [longitude, latitude]: LngLat,
) {
  const sinLambda = Math.sin(longitude / DEGREES);
  const cosLambda = Math.cos(longitude / DEGREES);
  const sinPhi = Math.sin(latitude / DEGREES);
  const cosPhi = Math.cos(latitude / DEGREES);
  const reach = scale * (distance - 1);

  return (sink: PathSink, rings: Float64Array[]) => {
    for (const ring of rings) {
      for (let index = 0; index < ring.length; index += 3) {
        const x = ring[index];
        const y = ring[index + 1];
        const z = ring[index + 2];
        const along = cosPhi * (x * cosLambda + y * sinLambda) + z * sinPhi;
        const perspective = reach / (distance - along);
        const screenX = centerX + perspective * (y * cosLambda - x * sinLambda);

        const screenY =
          centerY - perspective * (z * cosPhi - sinPhi * (x * cosLambda + y * sinLambda));

        if (index === 0) sink.moveTo(screenX, screenY);
        else sink.lineTo(screenX, screenY);
      }
    }
  };
}

export function globeView(
  { center: [longitude, latitude], zoom }: Camera,
  width: number,
  height: number,
): GlobeView {
  const scale = globeScale(zoom);
  const distance = 1 + (CAMERA_DISTANCE_PER_HEIGHT * height) / scale;
  const horizon = Math.acos(1 / distance);

  return {
    projection: geoProjection(perspectiveRaw(distance))
      .rotate([-longitude, -latitude])
      .scale(scale)
      .translate([width / 2, height / 2])
      .clipAngle(horizon * DEGREES)
      .precision(0),
    traceFront: frontTracer(distance, scale, [width / 2, height / 2], [longitude, latitude]),
    direction: unitVector([longitude, latitude]),
    scale,
    radius: scale * Math.sqrt((distance - 1) / (distance + 1)),
    horizon,
  };
}

function capAngle({ vector: [x, y, z] }: Cap, [directionX, directionY, directionZ]: Vector) {
  const cosAngle = x * directionX + y * directionY + z * directionZ;

  return Math.acos(Math.min(Math.max(cosAngle, -1), 1));
}

export function partVisibility({ cap }: CountryPart, { direction, horizon }: GlobeView) {
  const angle = capAngle(cap, direction);

  if (angle - cap.radius >= horizon) return "hidden";

  return angle + cap.radius < horizon ? "front" : "horizon";
}

const CAP_MARGIN = 1e-9;

export function countryAt(scene: GlobeScene, point: LngLat): string | null {
  const direction = unitVector(point);

  const country = scene.countries.find(
    ({ code, parts }) =>
      code !== null &&
      parts.some(
        ({ cap, area }) =>
          capAngle(cap, direction) <= cap.radius + CAP_MARGIN && geoContains(area, point),
      ),
  );

  return country?.code ?? null;
}

export function countryOutline(scene: GlobeScene, code: string | null): MultiLineString | null {
  const selected = code ? scene.countries.find((country) => country.code === code) : undefined;

  return selected?.outline ?? null;
}
