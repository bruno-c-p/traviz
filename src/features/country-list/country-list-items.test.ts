import { expect, test } from "bun:test";
import { countries } from "@/features/countries";
import { buildListSections, limitSectionRows } from "@/features/country-list/country-list-items";

test("limits the rows across sections in order and counts the rows it leaves out", () => {
  const sections = buildListSections(countries, null);
  const limited = limitSectionRows(sections, 20);

  expect(limited.map((section) => section.countries.length + section.hiddenCount)).toEqual(
    sections.map((section) => section.countries.length),
  );
  expect(limited.reduce((total, section) => total + section.countries.length, 0)).toBe(20);
  expect(limited[0]?.countries.map((country) => country.code)).toEqual(
    sections[0]?.countries.slice(0, 20).map((country) => country.code),
  );
  expect(limited.slice(1).every((section) => section.countries.length === 0)).toBe(true);
});

test("an unlimited row count leaves every section whole", () => {
  const sections = buildListSections(countries, null);

  expect(limitSectionRows(sections, Infinity)).toEqual(
    sections.map((section) => ({ ...section, hiddenCount: 0 })),
  );
});
