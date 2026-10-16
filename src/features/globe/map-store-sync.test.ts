import { describe, expect, test } from "bun:test";
import { countries, searchCountries } from "@/features/countries";
import { bindStoreSync } from "@/features/globe/map-store-sync";
import type { SyncedMap } from "@/features/globe/map-store-sync";
import { useSelectedCountryStore } from "@/features/globe/selected-country";

function recordingMap() {
  const flights: [number, number][] = [];

  const map: SyncedMap = {
    setPaintProperty: () => undefined,
    setFilter: () => undefined,
    flyTo: (options) => flights.push(options.center),
    getZoom: () => 1.4,
  };

  return { map, flights };
}

function searchAndChoose(query: string, code: string) {
  const match = searchCountries(query).find((country) => country.code === code);

  if (match) useSelectedCountryStore.getState().selectAndFly(match.code);
}

describe("globe search fly-to", () => {
  test("choosing any entry from a search of its name flies the globe to its center", () => {
    const { map, flights } = recordingMap();
    const unbind = bindStoreSync(map, {}, () => undefined);

    const grounded = countries.flatMap((country) => {
      const flightsBefore = flights.length;

      searchAndChoose(country.name, country.code);

      return flights.length === flightsBefore ? [country.code] : [];
    });

    unbind();

    expect(grounded).toEqual([]);
    expect(flights).toHaveLength(countries.length);
  });

  test("searching united s and choosing the Minor Outlying Islands flies there", () => {
    const { map, flights } = recordingMap();
    const unbind = bindStoreSync(map, {}, () => undefined);

    searchAndChoose("united s", "UMI");
    unbind();

    expect(flights).toEqual([[166.633333, 19.3]]);
  });
});
