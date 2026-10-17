import { afterEach, expect, test } from "bun:test";
import { useCountriesStore } from "@/features/marks";
import { useSelectedCountryStore } from "@/features/globe/selected-country";

afterEach(() => {
  useCountriesStore.setState({ ownerId: null, marks: {} });
  useSelectedCountryStore.setState({ selectedCode: null, pendingFlyCode: null });
});

test("a new marks owner clears the selected country and its pending fly", () => {
  useCountriesStore.setState({ ownerId: "user_a" });
  useSelectedCountryStore.getState().selectAndFly("JPN");

  useCountriesStore.setState({ ownerId: "user_b" });

  expect(useSelectedCountryStore.getState()).toMatchObject({
    selectedCode: null,
    pendingFlyCode: null,
  });
});

test("a marks change for the same owner keeps the selected country", () => {
  useCountriesStore.setState({ ownerId: "user_a" });
  useSelectedCountryStore.getState().select("JPN");

  useCountriesStore.setState({ marks: { JPN: "visited" } });

  expect(useSelectedCountryStore.getState().selectedCode).toBe("JPN");
});
