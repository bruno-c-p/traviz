import { describe, expect, it } from "vitest";
import { computeStats } from "../../src/lib/stats";
import type { Country } from "../../src/lib/stats";
import type { Marks } from "../../src/lib/colors";

const countries: Country[] = [
  { code: "FRA", name: "France", flag: "🇫🇷", continent: "Europe", counted: true },
  { code: "DEU", name: "Germany", flag: "🇩🇪", continent: "Europe", counted: true },
  { code: "ALA", name: "Åland Islands", flag: "🇦🇽", continent: "Europe", counted: false },
  { code: "JPN", name: "Japan", flag: "🇯🇵", continent: "Asia", counted: true },
  { code: "BRA", name: "Brazil", flag: "🇧🇷", continent: "South America", counted: true },
];

describe("computeStats", () => {
  it("headline denominator is the counted set, not the full row count", () => {
    const stats = computeStats({}, countries);
    expect(stats.headline.total).toBe(4);
  });

  it("headline counts only visited AND counted countries", () => {
    const marks: Marks = { FRA: "visited", ALA: "visited", JPN: "want" };
    const stats = computeStats(marks, countries);
    expect(stats.headline.visited).toBe(1);
  });

  it("totals include territories (counted: false) alongside counted countries", () => {
    const marks: Marks = { FRA: "visited", ALA: "visited" };
    const stats = computeStats(marks, countries);
    expect(stats.totals.visited).toBe(2);
  });

  it("totals cover all three states independently", () => {
    const marks: Marks = { FRA: "visited", DEU: "want", JPN: "not_interested" };
    const stats = computeStats(marks, countries);
    expect(stats.totals).toEqual({ visited: 1, want: 1, not_interested: 1 });
  });

  it("produces a breakdown for all 7 continents even when some have no data", () => {
    const stats = computeStats({}, countries);
    expect(Object.keys(stats.byContinent).sort()).toEqual(
      ["Africa", "Antarctica", "Asia", "Europe", "North America", "Oceania", "South America"].sort(),
    );
    expect(stats.byContinent.Africa).toEqual({
      visited: 0,
      want: 0,
      not_interested: 0,
      total: 0,
      countedTotal: 0,
      countedVisited: 0,
    });
    expect(stats.byContinent.Antarctica).toEqual({
      visited: 0,
      want: 0,
      not_interested: 0,
      total: 0,
      countedTotal: 0,
      countedVisited: 0,
    });
  });

  it("computes per-continent math, counting territories in the continent total", () => {
    const marks: Marks = { FRA: "visited", DEU: "want", ALA: "not_interested" };
    const stats = computeStats(marks, countries);
    expect(stats.byContinent.Europe).toEqual({
      visited: 1,
      want: 1,
      not_interested: 1,
      total: 3,
      countedTotal: 2,
      countedVisited: 1,
    });
    expect(stats.byContinent.Asia).toEqual({
      visited: 0,
      want: 0,
      not_interested: 0,
      total: 1,
      countedTotal: 1,
      countedVisited: 0,
    });
  });

  it("computes countedTotal and countedVisited per continent, excluding territories", () => {
    const stats = computeStats({}, countries);
    expect(stats.byContinent.Europe.countedTotal).toBe(2);
    expect(stats.byContinent.Asia.countedTotal).toBe(1);
    expect(stats.byContinent["South America"].countedTotal).toBe(1);
  });

  it("a visited territory increments totals/continent visited but not countedVisited", () => {
    const marks: Marks = { ALA: "visited" };
    const stats = computeStats(marks, countries);
    expect(stats.totals.visited).toBe(1);
    expect(stats.byContinent.Europe.visited).toBe(1);
    expect(stats.byContinent.Europe.countedVisited).toBe(0);
    expect(stats.headline.visited).toBe(0);
  });

  it("sum of countedTotal across continents equals headline.total", () => {
    const stats = computeStats({}, countries);
    const sum = Object.values(stats.byContinent).reduce((acc, c) => acc + c.countedTotal, 0);
    expect(sum).toBe(stats.headline.total);
  });

  it("sum of countedVisited across continents equals headline.visited", () => {
    const marks: Marks = { FRA: "visited", DEU: "visited", ALA: "visited", JPN: "visited", BRA: "visited" };
    const stats = computeStats(marks, countries);
    const sum = Object.values(stats.byContinent).reduce((acc, c) => acc + c.countedVisited, 0);
    expect(sum).toBe(stats.headline.visited);
  });

  it("a continent with no counted rows reports countedTotal 0, not NaN", () => {
    const stats = computeStats({}, countries);
    expect(stats.byContinent.Antarctica.countedTotal).toBe(0);
    expect(stats.byContinent.Antarctica.countedVisited).toBe(0);
    expect(Number.isNaN(stats.byContinent.Antarctica.countedTotal)).toBe(false);
  });

  it("ignores marks for codes not present in the countries list", () => {
    const marks: Marks = { XXX: "visited", FRA: "visited" };
    const stats = computeStats(marks, countries);
    expect(stats.totals.visited).toBe(1);
    expect(stats.headline.visited).toBe(1);
  });

  it("is a pure function of its inputs and does not mutate them", () => {
    const marks: Marks = { FRA: "visited" };
    const marksCopy = { ...marks };
    const countriesCopy = countries.map((c) => ({ ...c }));

    const a = computeStats(marks, countries);
    const b = computeStats(marks, countries);

    expect(a).toEqual(b);
    expect(marks).toEqual(marksCopy);
    expect(countries).toEqual(countriesCopy);
  });
});
