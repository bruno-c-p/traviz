import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { countries } from "@/features/countries";
import type { Country } from "@/features/countries";
import type { Marks } from "@/features/marks";
import { ContinentCard } from "@/features/stats/continent-card";
import { CONTINENT_POOLS } from "@/features/stats/continent-pools";

describe("continent cards", () => {
  test.each([
    ["Africa", "0 / 54", false],
    ["Asia", "0 / 47", false],
    ["Europe", "0 / 45", false],
    ["North America", "0 / 23", false],
    ["South America", "0 / 12", false],
    ["Oceania", "0 / 14", false],
    ["Antarctica", "0 / 5", true],
  ] as const)(
    "the %s card counts %s, territories only: %p",
    (continent, fraction, isTerritoriesOnly) => {
      const pool = CONTINENT_POOLS.find((candidate) => candidate.continent === continent);

      expect(pool?.isTerritoriesOnly).toBe(isTerritoriesOnly);

      const markup = pool ? renderToStaticMarkup(<ContinentCard pool={pool} marks={{}} />) : "";

      expect(markup).toContain(`>${fraction}<`);
    },
  );

  test.each([
    ["every entry is on the wish list", () => "want" as const],
    ["every entry is visited", () => "visited" as const],
    ["every entry is skipped", () => "not_interested" as const],
    [
      "sovereign entries are visited and territories are on the wish list",
      (country: Country) => (country.kind === "sovereign" ? "visited" : "want"),
    ],
  ] as const)(
    "F9.1 (introduced ead9d76): every continent bar fills exactly 100%% when %s",
    (_scenario, stateFor) => {
      const marks: Marks = Object.fromEntries(
        countries.map((country) => [country.code, stateFor(country)]),
      );

      const misfilled = CONTINENT_POOLS.flatMap((pool) => {
        const markup = renderToStaticMarkup(<ContinentCard pool={pool} marks={marks} />);

        const filled = [...markup.matchAll(/width:\s*([\d.]+)%/g)].reduce(
          (sum, match) => sum + Number(match[1]),
          0,
        );

        return Math.abs(filled - 100) > 0.0001 ? [`${pool.continent} ${filled.toFixed(1)}%`] : [];
      });

      expect(misfilled).toEqual([]);
    },
  );
});
