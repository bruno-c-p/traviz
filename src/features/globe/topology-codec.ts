const ALPHABET =
  " !#%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^_abcdefghijklmnopqrstuvwxyz{|}~";

const SINGLE_DIGITS = 68;
const CARRY_DIGITS = ALPHABET.length - SINGLE_DIGITS;
const MIN_RING_POINTS = 4;
const CODE_SEPARATOR = ",";

type Pair = readonly [number, number];

type Point = [longitude: number, latitude: number];

export type PackedTopology = {
  scale: Pair;
  translate: Pair;
  codes: string;
  rings: string;
  arcs: string;
};

export type CountryOutline = { code: string | null; polygons: Point[][][] };

export type TopologySource = {
  scale: Pair;
  translate: Pair;
  arcs: readonly (readonly number[][])[];
  countries: readonly { code: string | undefined; polygons: readonly number[][][] }[];
};

function encodeInteger(value: number): string {
  const unsigned = value < 0 ? -value * 2 - 1 : value * 2;

  if (unsigned < SINGLE_DIGITS) return ALPHABET.charAt(unsigned);

  let rest = unsigned - SINGLE_DIGITS;
  let text = "";

  do {
    text += ALPHABET.charAt(SINGLE_DIGITS + (rest % CARRY_DIGITS));
    rest = Math.floor(rest / CARRY_DIGITS);
  } while (rest >= SINGLE_DIGITS);

  return text + ALPHABET.charAt(rest);
}

export function packTopology({
  scale,
  translate,
  arcs,
  countries,
}: TopologySource): PackedTopology {
  let previousArc = 0;

  const encodeArc = (arc: number) => {
    const text = encodeInteger(arc - previousArc);

    previousArc = arc;

    return text;
  };

  return {
    scale,
    translate,
    codes: countries.map(({ code }) => code ?? "").join(CODE_SEPARATOR),
    rings: countries
      .map(
        ({ polygons }) =>
          encodeInteger(polygons.length) +
          polygons
            .map(
              (rings) =>
                encodeInteger(rings.length) +
                rings
                  .map((ring) => encodeInteger(ring.length) + ring.map(encodeArc).join(""))
                  .join(""),
            )
            .join(""),
      )
      .join(""),
    arcs: arcs
      .map(
        (arc) =>
          encodeInteger(arc.length) +
          arc.map(([x = 0, y = 0]) => encodeInteger(x) + encodeInteger(y)).join(""),
      )
      .join(""),
  };
}

function integerReader(text: string) {
  const digits = new Uint8Array(128);
  let position = 0;

  for (let index = 0; index < ALPHABET.length; index += 1) {
    digits[ALPHABET.charCodeAt(index)] = index;
  }

  return {
    hasMore: () => position < text.length,
    next: () => {
      let value = 0;
      let weight = 1;
      let digit = digits[text.charCodeAt(position)];

      position += 1;

      while (digit >= SINGLE_DIGITS) {
        value += (digit - SINGLE_DIGITS) * weight + (weight === 1 ? SINGLE_DIGITS : 0);
        weight *= CARRY_DIGITS;
        digit = digits[text.charCodeAt(position)];
        position += 1;
      }

      value += digit * weight;

      return value % 2 === 1 ? -(value + 1) / 2 : value / 2;
    },
  };
}

function times<T>(count: number, make: () => T): T[] {
  return Array.from({ length: count }, make);
}

function unpackArcs({ scale, translate, arcs }: PackedTopology): Point[][] {
  const integers = integerReader(arcs);
  const unpacked: Point[][] = [];

  while (integers.hasMore()) {
    let x = 0;
    let y = 0;

    unpacked.push(
      times(integers.next(), () => {
        x += integers.next();
        y += integers.next();

        return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
      }),
    );
  }

  return unpacked;
}

export function unpackTopology(packed: PackedTopology): CountryOutline[] {
  const arcs = unpackArcs(packed);
  const integers = integerReader(packed.rings);
  let previousArc = 0;

  const readRing = (): Point[] => {
    const ring: Point[] = [];
    const arcCount = integers.next();

    for (let index = 0; index < arcCount; index += 1) {
      previousArc += integers.next();

      const arc = arcs[previousArc < 0 ? ~previousArc : previousArc] ?? [];

      ring.pop();
      ring.push(...(previousArc < 0 ? arc.toReversed() : arc));
    }

    const [first] = ring;

    while (first && ring.length < MIN_RING_POINTS) ring.push(first);

    return ring;
  };

  return packed.codes.split(CODE_SEPARATOR).map((code) => ({
    code: code === "" ? null : code,
    polygons: times(integers.next(), () => times(integers.next(), readRing)),
  }));
}
