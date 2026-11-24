import { normalizeSearchText, searchByName } from "@/features/countries";

export type GlobeCountry = {
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

export const MAX_SEARCH_RESULTS = 6;

export function encodeGlobeCountries(records: readonly CountryRecord[]): string {
  return records
    .map((record) =>
      [
        record.code,
        record.name,
        record.continent,
        record.kind === "territory" ? TERRITORY_FLAG : "",
      ].join(FIELD_SEPARATOR),
    )
    .join(ROW_SEPARATOR);
}

export function decodeGlobeCountries(text: string): GlobeCountry[] {
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

export function searchGlobeCountries(
  countries: readonly GlobeCountry[],
  query: string,
): GlobeCountry[] {
  return searchByName(countries, query, (country) => country.searchText).slice(
    0,
    MAX_SEARCH_RESULTS,
  );
}

export function countryMeta(country: GlobeCountry): string {
  return `${country.continent} · ${country.code}${country.isTerritory ? " · Territory" : ""}`;
}
