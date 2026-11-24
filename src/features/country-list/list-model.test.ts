import { describe, expect, test } from "bun:test";
import { CONTINENT_ORDER, countries, searchCountries } from "@/features/countries";
import {
  continentOptions,
  decodeListRows,
  encodeListRows,
  listLayout,
  listRowsOf,
  parseListFilter,
  searchRows,
  stateCounts,
  toggledFilters,
} from "@/features/country-list/list-model";
import type { ListSelection } from "@/features/country-list/list-model";
import type { Marks } from "@/features/marks";

const rows = listRowsOf(CONTINENT_ORDER, countries);
const everything: ListSelection = { continent: null, filters: new Set(), query: "" };
const names = (list: readonly { name: string }[]) => list.map((row) => row.name);

describe("the list rows", () => {
  test("follow the continent order, then the dataset order, from Algeria to South Georgia", () => {
    expect(rows).toHaveLength(250);
    expect(rows[0]?.name).toBe("Algeria");
    expect(rows.at(-1)?.name).toBe("South Georgia");
    expect(names(rows)).toEqual(
      CONTINENT_ORDER.flatMap((continent) =>
        names(countries.filter((country) => country.continent === continent)),
      ),
    );
  });

  test("survive the wire that carries them in the page", () => {
    expect(decodeListRows(encodeListRows(rows))).toEqual(rows);
  });

  test("hold no character that would break the wire or end its script element", () => {
    expect(encodeListRows(rows)).not.toMatch(/[<&]/);
    expect(rows.filter((row) => /[\t\n]/.test(row.name + row.code + row.continent))).toEqual([]);
  });

  test("mark the territories", () => {
    expect(rows.filter((row) => row.isTerritory)).toHaveLength(
      countries.filter((country) => country.kind === "territory").length,
    );
  });
});

describe("searchRows", () => {
  test("zam gives Zambia, then Mozambique", () => {
    expect(names(searchRows(rows, "zam"))).toEqual(["Zambia", "Mozambique"]);
  });

  test.each(["a", "an", "Å", "  cote ", "land", "united", "zz", "é", "s", ""])(
    "%p matches searchCountries over the dataset",
    (query) => {
      expect(names(searchRows(rows, query))).toEqual(names(searchCountries(query)));
    },
  );
});

describe("listLayout", () => {
  const marks: Marks = { DZA: "visited", AGO: "want", FRA: "visited", JPN: "not_interested" };

  test("with nothing selected it lists every continent in order under All countries", () => {
    const layout = listLayout(rows, marks, everything);

    expect(layout.heading).toBe("All countries");
    expect(layout.results).toBeNull();
    expect(layout.emptyMessage).toBeNull();
    expect(layout.sections.map((section) => section.continent)).toEqual([...CONTINENT_ORDER]);
    expect(layout.sections.flatMap((section) => names(section.rows))).toEqual(names(rows));
  });

  test("a continent limits the rows and names the heading", () => {
    const layout = listLayout(rows, marks, { ...everything, continent: "Europe" });

    expect(layout.heading).toBe("Europe");
    expect(layout.sections.map((section) => section.continent)).toEqual(["Europe"]);
    expect(layout.sections[0]?.rows).toHaveLength(53);
    expect(layout.sections[0]?.rows[0]?.name).toBe("Åland Islands");
  });

  test("status filters combine, and drop the continents they empty", () => {
    const layout = listLayout(rows, marks, {
      ...everything,
      filters: new Set(["visited", "want"]),
    });

    expect(layout.sections.map((section) => [section.continent, names(section.rows)])).toEqual([
      ["Africa", ["Algeria", "Angola"]],
      ["Europe", ["France"]],
    ]);
  });

  test("the unmarked filter keeps the countries with no mark", () => {
    const layout = listLayout(rows, marks, { ...everything, filters: new Set(["unmarked"]) });

    expect(layout.sections.flatMap((section) => section.rows)).toHaveLength(246);
  });

  test("a query gives one ranked list inside the continent and the filters", () => {
    const layout = listLayout(rows, marks, {
      continent: "Africa",
      filters: new Set(["visited", "unmarked"]),
      query: " al ",
    });

    expect(layout.sections).toEqual([]);
    expect(names(layout.results ?? [])).toEqual(
      names(
        searchCountries(
          "al",
          countries.filter(
            (country) => country.continent === "Africa" && marks[country.code] !== "want",
          ),
        ),
      ),
    );
    expect(names(layout.results ?? [])[0]).toBe("Algeria");
  });

  test("no match says so, for a query and for filters", () => {
    expect(listLayout(rows, marks, { ...everything, query: "qqq" }).emptyMessage).toBe(
      "No countries match “qqq”.",
    );
    expect(
      listLayout(rows, {}, { ...everything, filters: new Set(["visited"]) }).emptyMessage,
    ).toBe("No countries match the selected filters.");
  });
});

describe("counts", () => {
  const marks: Marks = { DZA: "visited", AGO: "want", FRA: "visited", JPN: "not_interested" };

  test("the status counts cover the selected continent and ignore the search", () => {
    expect(stateCounts(rows, marks, null)).toEqual({
      visited: 2,
      want: 1,
      not_interested: 1,
      unmarked: 246,
    });
    expect(stateCounts(rows, marks, "Europe")).toEqual({
      visited: 1,
      want: 0,
      not_interested: 0,
      unmarked: 52,
    });
  });

  test("the continent options count visited places of all countries, then of each continent", () => {
    const options = continentOptions(rows, marks);

    expect(options.map((option) => option.label)).toEqual(["All countries", ...CONTINENT_ORDER]);
    expect(options[0]).toEqual({ continent: null, label: "All countries", visited: 2, total: 250 });
    expect(options.find((option) => option.continent === "Europe")).toMatchObject({
      visited: 1,
      total: 53,
    });
  });
});

test("toggling a filter adds it, then removes it, without changing the set it was given", () => {
  const none = new Set<never>();
  const visited = toggledFilters(none, "visited");

  expect([...visited]).toEqual(["visited"]);
  expect([...toggledFilters(visited, "want")]).toEqual(["visited", "want"]);
  expect([...toggledFilters(visited, "visited")]).toEqual([]);
  expect(none.size).toBe(0);
});

test("a filter attribute parses to a state key or nothing", () => {
  expect(parseListFilter("unmarked")).toBe("unmarked");
  expect(parseListFilter("everything")).toBeNull();
  expect(parseListFilter(undefined)).toBeNull();
});
