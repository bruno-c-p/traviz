import { beforeEach, expect, test } from "bun:test";
import { COUNTRIES_BY_CODE } from "@/features/countries";
import { selectClickedCountry } from "@/features/globe/map-country-events";
import { useSelectedCountryStore } from "@/features/globe/selected-country";

beforeEach(() => {
  useSelectedCountryStore.setState({ selectedCode: null, pendingFlyCode: null });
});

test("clicking Kosovo on the globe opens the Kosovo card", () => {
  selectClickedCountry({ properties: { iso_3166_1_alpha_3: "XKS", name_en: "Kosovo" } });

  const selectedCode = useSelectedCountryStore.getState().selectedCode;

  expect(selectedCode).toBe("UNK");
  expect(COUNTRIES_BY_CODE.get(selectedCode ?? "")?.name).toBe("Kosovo");
});
