import { expect, test } from "bun:test";
import { countries } from "@/features/countries";
import type { Marks } from "@/features/marks";
import { CONTINENT_POOLS } from "@/features/stats/continent-pools";
import {
  decodeContinentCodes,
  encodeContinentCodes,
  statsModel,
} from "@/features/stats/stats-model";

const territories = countries.filter((country) => country.kind === "territory");

function marksOf(visited: number, want: number, notInterested: number): Marks {
  return Object.fromEntries(
    countries
      .slice(0, visited + want + notInterested)
      .map((country, index) => [
        country.code,
        index < visited ? "visited" : index < visited + want ? "want" : "not_interested",
      ]),
  );
}

test("the seeded marks read 30 of 243 · 12.3%, with 7 left out", () => {
  const model = statsModel(CONTINENT_POOLS, marksOf(30, 12, 7));

  expect(model.visited).toBe(30);
  expect(model.totalText).toBe("of 243 · 12.3%");
  expect(model.excludedText).toBe("7 not interested left out");
  expect(model.want).toBe(12);
  expect(model.notInterested).toBe(7);
  expect(model.reachableWidth).toBeCloseTo(97.2);
  expect(model.visitedOffset).toBeCloseTo((30 / 243) * 100 - 100);
});

test("50 visited places read as 20.0% of 250", () => {
  const model = statsModel(CONTINENT_POOLS, marksOf(50, 0, 0));

  expect(model.visited).toBe(50);
  expect(model.want).toBe(0);
  expect(model.excluded).toBe(0);
  expect(model.totalText).toBe("of 250 · 20.0%");
});

test("visited and wanted territories count like countries", () => {
  const marks: Marks = Object.fromEntries(
    territories.map((country, index) => [country.code, index % 2 === 0 ? "visited" : "want"]),
  );

  const visited = Math.ceil(territories.length / 2);
  const model = statsModel(CONTINENT_POOLS, marks);

  expect(model.visited).toBe(visited);
  expect(model.want).toBe(territories.length - visited);
  expect(model.excluded).toBe(0);
  expect(model.totalText).toBe(`of 250 · ${((visited / 250) * 100).toFixed(1)}%`);
});

test("not interested places, territories included, leave the total", () => {
  const marks: Marks = {
    ...Object.fromEntries(
      countries.slice(0, 18).map((country) => [country.code, "not_interested"]),
    ),
    [territories.at(-1)?.code ?? ""]: "not_interested",
    [countries[20]?.code ?? ""]: "visited",
  };

  const model = statsModel(CONTINENT_POOLS, marks);

  expect(model.visited).toBe(1);
  expect(model.excluded).toBe(19);
  expect(model.notInterested).toBe(19);
  expect(model.excludedText).toBe("19 not interested left out");
  expect(model.totalText).toBe(`of 231 · ${((1 / 231) * 100).toFixed(1)}%`);
  expect(model.reachableWidth).toBeCloseTo((231 / 250) * 100);
});

test("each continent counts its own visited, wished and unmarked places", () => {
  const africa = CONTINENT_POOLS[0]?.countries ?? [];

  const marks: Marks = {
    [africa[0]?.code ?? ""]: "visited",
    [africa[1]?.code ?? ""]: "want",
    [africa[2]?.code ?? ""]: "not_interested",
  };

  const [first, second] = statsModel(CONTINENT_POOLS, marks).continents;

  expect(first?.continent).toBe("Africa");
  expect(first?.countText).toBe(`1 / ${africa.length}`);
  expect(first?.summary).toBe(`1 on the wish list · ${africa.length - 3} unmarked`);
  expect(first?.shares.map((share) => share.toFixed(4))).toEqual(
    Array.from({ length: 3 }, () => (100 / africa.length).toFixed(4)),
  );
  expect(second?.countText).toMatch(/^0 \/ \d+$/);
  expect(second?.shares).toEqual([0, 0, 0]);
});

test("no marks read 0 of 250 with nothing left out, and every place skipped reads 0 of 0", () => {
  const empty = statsModel(CONTINENT_POOLS, {});
  const skipped = statsModel(CONTINENT_POOLS, marksOf(0, 0, countries.length));

  expect(empty.totalText).toBe("of 250 · 0.0%");
  expect(empty.excluded).toBe(0);
  expect(empty.reachableWidth).toBe(100);
  expect(skipped.totalText).toBe("of 0 · 0.0%");
  expect(skipped.reachableWidth).toBe(0);
});

test("the continent codes survive the wire, so the browser computes the same model", () => {
  const decoded = decodeContinentCodes(encodeContinentCodes(CONTINENT_POOLS));
  const marks = marksOf(30, 12, 7);

  expect(decoded.map((pool) => pool.continent)).toEqual(
    CONTINENT_POOLS.map((pool) => pool.continent),
  );
  expect(statsModel(decoded, marks)).toEqual(statsModel(CONTINENT_POOLS, marks));
});
