import { tallyMarks } from "@/features/marks/core";
import type { Marks, StateColorKey } from "@/features/marks/core";

export type ListRow = {
  readonly code: string;
  readonly name: string;
  readonly continent: string;
  readonly isTerritory: boolean;
  readonly searchText: string;
};

export type ListSelection = {
  readonly continent: string | null;
  readonly filters: ReadonlySet<StateColorKey>;
  readonly query: string;
};

export type ContinentOption = {
  readonly continent: string | null;
  readonly label: string;
  readonly visited: number;
  readonly total: number;
};

export type ListSectionRows = { readonly continent: string; readonly rows: readonly ListRow[] };

export type ListLayout = {
  readonly heading: string;
  readonly sections: readonly ListSectionRows[];
  readonly results: readonly ListRow[] | null;
  readonly emptyMessage: string | null;
};

export const ALL_COUNTRIES_LABEL = "All countries";

export const LIST_FILTERS: readonly { readonly value: StateColorKey; readonly label: string }[] = [
  { value: "visited", label: "Visited" },
  { value: "want", label: "Want to go" },
  { value: "not_interested", label: "Not interested" },
  { value: "unmarked", label: "Unmarked" },
];

const FIELD_SEPARATOR = "\t";
const ROW_SEPARATOR = "\n";
const TERRITORY_FLAG = "t";

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

type ListCountry = {
  readonly code: string;
  readonly name: string;
  readonly continent: string;
  readonly kind: string;
};

export function listRowsOf(
  continents: readonly string[],
  countries: readonly ListCountry[],
): ListRow[] {
  return continents.flatMap((continent) =>
    countries.flatMap((country) =>
      country.continent === continent
        ? [
            {
              code: country.code,
              name: country.name,
              continent,
              isTerritory: country.kind === "territory",
              searchText: normalizeSearchText(country.name),
            },
          ]
        : [],
    ),
  );
}

export function encodeListRows(rows: readonly ListRow[]): string {
  return rows
    .map((row) =>
      [row.code, row.name, row.continent, row.isTerritory ? TERRITORY_FLAG : ""].join(
        FIELD_SEPARATOR,
      ),
    )
    .join(ROW_SEPARATOR);
}

export function decodeListRows(text: string): ListRow[] {
  return text.split(ROW_SEPARATOR).flatMap((line) => {
    const [code, name, continent, flag] = line.split(FIELD_SEPARATOR);

    if (code === undefined || name === undefined || continent === undefined) return [];

    return [
      {
        code,
        name,
        continent,
        isTerritory: flag === TERRITORY_FLAG,
        searchText: normalizeSearchText(name),
      },
    ];
  });
}

export function continentsOf(rows: readonly ListRow[]): string[] {
  return [...new Set(rows.map((row) => row.continent))];
}

function continentPool(rows: readonly ListRow[], continent: string | null): readonly ListRow[] {
  return continent === null ? rows : rows.filter((row) => row.continent === continent);
}

export function continentOptions(rows: readonly ListRow[], marks: Marks): ContinentOption[] {
  return [
    {
      continent: null,
      label: ALL_COUNTRIES_LABEL,
      visited: tallyMarks(rows, marks).visited,
      total: rows.length,
    },
    ...continentsOf(rows).map((continent) => {
      const pool = continentPool(rows, continent);

      return {
        continent,
        label: continent,
        visited: tallyMarks(pool, marks).visited,
        total: pool.length,
      };
    }),
  ];
}

export function stateCounts(rows: readonly ListRow[], marks: Marks, continent: string | null) {
  return tallyMarks(continentPool(rows, continent), marks);
}

export function searchRows(rows: readonly ListRow[], query: string): ListRow[] {
  const normalizedQuery = normalizeSearchText(query.trim());

  if (!normalizedQuery) return [];

  const byName = (first: ListRow, second: ListRow) => first.name.localeCompare(second.name);

  return [
    ...rows.filter((row) => row.searchText.startsWith(normalizedQuery)).sort(byName),
    ...rows.filter((row) => row.searchText.indexOf(normalizedQuery) > 0).sort(byName),
  ];
}

export function listLayout(
  rows: readonly ListRow[],
  marks: Marks,
  { continent, filters, query }: ListSelection,
): ListLayout {
  const pool = continentPool(rows, continent);

  const filtered =
    filters.size === 0 ? pool : pool.filter((row) => filters.has(marks[row.code] ?? "unmarked"));

  const trimmedQuery = query.trim();
  const heading = continent ?? ALL_COUNTRIES_LABEL;

  if (trimmedQuery) {
    const results = searchRows(filtered, trimmedQuery);

    return {
      heading,
      sections: [],
      results,
      emptyMessage: results.length > 0 ? null : `No countries match “${trimmedQuery}”.`,
    };
  }

  const sections = continentsOf(filtered).map((sectionContinent) => ({
    continent: sectionContinent,
    rows: filtered.filter((row) => row.continent === sectionContinent),
  }));

  return {
    heading,
    sections,
    results: null,
    emptyMessage: sections.length > 0 ? null : "No countries match the selected filters.",
  };
}

export function toggledFilters(
  filters: ReadonlySet<StateColorKey>,
  value: StateColorKey,
): ReadonlySet<StateColorKey> {
  const next = new Set(filters);

  if (!next.delete(value)) next.add(value);

  return next;
}

export function parseListFilter(value: string | undefined): StateColorKey | null {
  return LIST_FILTERS.find((filter) => filter.value === value)?.value ?? null;
}
