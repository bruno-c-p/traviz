import { normalizeSearchText } from "@/features/countries/search-by-name";

export type CountryRow = {
  readonly code: string;
  readonly name: string;
  readonly continent: string;
  readonly isTerritory: boolean;
  readonly searchText: string;
};

type CountryRecord = {
  readonly code: string;
  readonly name: string;
  readonly continent: string;
  readonly kind: string;
};

const FIELD_SEPARATOR = "\t";
const ROW_SEPARATOR = "\n";
const TERRITORY_FLAG = "t";

export function countryRowOf(record: CountryRecord): CountryRow {
  return {
    code: record.code,
    name: record.name,
    continent: record.continent,
    isTerritory: record.kind === "territory",
    searchText: normalizeSearchText(record.name),
  };
}

export function encodeCountryRows(rows: readonly CountryRow[]): string {
  return rows
    .map((row) =>
      [row.code, row.name, row.continent, row.isTerritory ? TERRITORY_FLAG : ""].join(
        FIELD_SEPARATOR,
      ),
    )
    .join(ROW_SEPARATOR);
}

export function decodeCountryRows(text: string): CountryRow[] {
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
