import { geoBounds, geoCentroid, geoContains, geoDistance, geoProjection } from "d3-geo";
import type { GeoProjection, GeoRawProjection } from "d3-geo";
import type { Feature, Geometry, MultiLineString, Position } from "geojson";
import { feature, mesh } from "topojson-client";
import type { GeometryCollection, GeometryObject, Topology } from "topojson-specification";
import { globeScale } from "@/features/globe/globe-camera";
import type { Camera, LngLat } from "@/features/globe/globe-camera";

const DEGREES = 180 / Math.PI;

export type CountryTopology = Topology<{ countries: GeometryCollection }>;

type Bounds = [southWest: LngLat, northEast: LngLat];

type Vector = [x: number, y: number, z: number];

type Cap = { vector: Vector; radius: number };

type CountryPart = { area: Feature; rings: Float64Array[]; cap: Cap };

type GlobeCountry = {
  code: string | null;
  feature: Feature;
  geometry: GeometryObject;
  bounds: Bounds;
  parts: CountryPart[];
};

export type GlobeScene = {
  topology: CountryTopology;
  countries: GlobeCountry[];
};

function polygons(geometry: Geometry): Position[][][] {
  if (geometry.type === "Polygon") return [geometry.coordinates];

  if (geometry.type === "MultiPolygon") return geometry.coordinates;

  return [];
}

function unitVector([longitude, latitude]: Position): Vector {
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

function countryPart(rings: Position[][]): CountryPart {
  const area: Feature = {
    type: "Feature",
    properties: null,
    geometry: { type: "Polygon", coordinates: rings },
  };

  const center = geoCentroid(area);

  const radius = Math.max(
    ...rings.flat().map(([longitude, latitude]) => geoDistance(center, [longitude, latitude])),
  );

  return { area, rings: unitVectors(rings), cap: { vector: unitVector(center), radius } };
}

export function buildScene(topology: CountryTopology): GlobeScene {
  const { geometries } = topology.objects.countries;
  const { features } = feature(topology, topology.objects.countries);

  return {
    topology,
    countries: geometries.map((geometry, index) => {
      const area = features[index];

      return {
        code: geometry.id === undefined ? null : String(geometry.id),
        feature: area,
        geometry,
        bounds: geoBounds(area),
        parts: polygons(area.geometry).map(countryPart),
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
    radius: scale * Math.sqrt((distance - 1) / (distance + 1)),
    horizon,
  };
}

export function partVisibility({ cap }: CountryPart, { direction, horizon }: GlobeView) {
  const [x, y, z] = cap.vector;
  const [directionX, directionY, directionZ] = direction;
  const cosAngle = x * directionX + y * directionY + z * directionZ;
  const angle = Math.acos(Math.min(Math.max(cosAngle, -1), 1));

  if (angle - cap.radius >= horizon) return "hidden";

  return angle + cap.radius < horizon ? "front" : "horizon";
}

function isWithinBounds([longitude, latitude]: LngLat, [[west, south], [east, north]]: Bounds) {
  if (latitude < south || latitude > north) return false;

  return west <= east
    ? longitude >= west && longitude <= east
    : longitude >= west || longitude <= east;
}

export function countryAt(scene: GlobeScene, point: LngLat): string | null {
  const country = scene.countries.find(
    ({ code, bounds, feature: area }) =>
      code !== null && isWithinBounds(point, bounds) && geoContains(area, point),
  );

  return country?.code ?? null;
}

export function countryOutline(scene: GlobeScene, code: string | null): MultiLineString | null {
  const selected = code ? scene.countries.find((country) => country.code === code) : undefined;

  return selected ? mesh(scene.topology, selected.geometry) : null;
}
