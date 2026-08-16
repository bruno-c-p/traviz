import { beforeEach, describe, expect, it } from "vitest";
import { useCountriesStore } from "../../src/store/countries";

describe("useCountriesStore", () => {
  beforeEach(() => {
    useCountriesStore.getState().resetAll();
  });

  it("starts with no marks", () => {
    expect(useCountriesStore.getState().marks).toEqual({});
  });

  it("mark sets a country's state", () => {
    useCountriesStore.getState().mark("FRA", "visited");
    expect(useCountriesStore.getState().marks).toEqual({ FRA: "visited" });
  });

  it("mark overwrites an existing state", () => {
    useCountriesStore.getState().mark("FRA", "visited");
    useCountriesStore.getState().mark("FRA", "want");
    expect(useCountriesStore.getState().marks).toEqual({ FRA: "want" });
  });

  it("clear removes the key entirely instead of storing an 'unmarked' value", () => {
    useCountriesStore.getState().mark("FRA", "visited");
    useCountriesStore.getState().clear("FRA");

    const marks = useCountriesStore.getState().marks;
    expect(marks).toEqual({});
    expect(Object.prototype.hasOwnProperty.call(marks, "FRA")).toBe(false);
    expect(marks.FRA).toBeUndefined();
  });

  it("clear on an already-unmarked country is a no-op", () => {
    useCountriesStore.getState().clear("FRA");
    expect(useCountriesStore.getState().marks).toEqual({});
  });

  it("toggle sets the state when the country is unmarked", () => {
    useCountriesStore.getState().toggle("JPN", "want");
    expect(useCountriesStore.getState().marks).toEqual({ JPN: "want" });
  });

  it("toggle clears the country when the same state is toggled again", () => {
    useCountriesStore.getState().toggle("JPN", "want");
    useCountriesStore.getState().toggle("JPN", "want");

    const marks = useCountriesStore.getState().marks;
    expect(marks).toEqual({});
    expect(Object.prototype.hasOwnProperty.call(marks, "JPN")).toBe(false);
  });

  it("toggle switches to a different state instead of clearing", () => {
    useCountriesStore.getState().toggle("JPN", "want");
    useCountriesStore.getState().toggle("JPN", "visited");
    expect(useCountriesStore.getState().marks).toEqual({ JPN: "visited" });
  });

  it("replaceAll replaces the whole marks map", () => {
    useCountriesStore.getState().mark("FRA", "visited");
    useCountriesStore.getState().replaceAll({ JPN: "want", DEU: "not_interested" });
    expect(useCountriesStore.getState().marks).toEqual({ JPN: "want", DEU: "not_interested" });
  });

  it("replaceAll does not alias the caller's object", () => {
    const input = { FRA: "visited" as const };
    useCountriesStore.getState().replaceAll(input);
    useCountriesStore.getState().clear("FRA");
    expect(input).toEqual({ FRA: "visited" });
  });

  it("resetAll wipes everything", () => {
    useCountriesStore.getState().mark("FRA", "visited");
    useCountriesStore.getState().mark("JPN", "want");
    useCountriesStore.getState().resetAll();
    expect(useCountriesStore.getState().marks).toEqual({});
  });

  it("never stores an explicit 'unmarked' value for any key", () => {
    useCountriesStore.getState().mark("FRA", "visited");
    useCountriesStore.getState().mark("JPN", "want");
    useCountriesStore.getState().mark("DEU", "not_interested");

    const values = Object.values(useCountriesStore.getState().marks);
    expect(values.every((v) => v === "visited" || v === "want" || v === "not_interested")).toBe(
      true,
    );
  });
});
