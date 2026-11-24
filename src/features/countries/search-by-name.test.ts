import { describe, expect, test } from "bun:test";
import { normalizeSearchText, searchByName } from "@/features/countries/search-by-name";

const PLACES = [
  { name: "Nigeria" },
  { name: "Niger" },
  { name: "Åland Islands" },
  { name: "Benin" },
  { name: "Curaçao" },
];

function search(query: string) {
  return searchByName(PLACES, query, (place) => normalizeSearchText(place.name)).map(
    (place) => place.name,
  );
}

describe("search by name", () => {
  test("a blank query finds nothing", () => {
    expect(search("")).toEqual([]);
    expect(search("   ")).toEqual([]);
  });

  test("names that start with the query come first, each group in name order", () => {
    expect(search("ni")).toEqual(["Niger", "Nigeria", "Benin"]);
  });

  test("accents and case do not matter on either side", () => {
    expect(search("aland")).toEqual(["Åland Islands"]);
    expect(search("CURAÇAO")).toEqual(["Curaçao"]);
  });

  test("spaces around the query are ignored", () => {
    expect(search("  benin ")).toEqual(["Benin"]);
  });
});
