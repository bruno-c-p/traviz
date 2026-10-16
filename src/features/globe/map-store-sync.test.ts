import { beforeEach, describe, expect, test } from "bun:test";
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

  if (!match) throw new Error(`Searching "${query}" did not find ${code}`);

  useSelectedCountryStore.getState().selectAndFly(match.code);
}

describe("globe search fly-to", () => {
  beforeEach(() => {
    useSelectedCountryStore.setState({ selectedCode: null, flyRequest: null });
  });

  test("choosing any entry from a search of its name flies the globe to its center", () => {
    const { map, flights } = recordingMap();
    const unbind = bindStoreSync(map, {}, () => undefined);

    const missedCenter = countries.flatMap((country) => {
      const flightsBefore = flights.length;

      searchAndChoose(country.name, country.code);

      const [longitude, latitude] = flights.at(-1) ?? [];

      const flewToCenter =
        flights.length === flightsBefore + 1 &&
        longitude === country.center[0] &&
        latitude === country.center[1];

      return flewToCenter ? [] : [country.code];
    });

    unbind();

    expect(missedCenter).toEqual([]);
  });

  test("searching united s and choosing the Minor Outlying Islands flies there", () => {
    const { map, flights } = recordingMap();
    const unbind = bindStoreSync(map, {}, () => undefined);

    searchAndChoose("united s", "UMI");
    unbind();

    expect(flights).toEqual([[166.633333, 19.3]]);
  });
});
