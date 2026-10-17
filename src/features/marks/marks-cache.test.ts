import { expect, test } from "bun:test";
import { createMarksCache } from "@/features/marks/marks-cache";
import { createFakeStorage } from "@/shared/testing/fake-storage";

const RETIRED = { "traviz-marks": '{"state":{"marks":{"DEU":"visited"}},"version":0}' };

test("a written cache reads back as the same owner and marks", () => {
  const { storage } = createFakeStorage();
  const cache = createMarksCache(() => storage);

  cache.write({ ownerId: "user_a", marks: { DEU: "visited", FRA: "want", ITA: "not_interested" } });

  expect(cache.read()).toEqual({
    ownerId: "user_a",
    marks: { DEU: "visited", FRA: "want", ITA: "not_interested" },
  });
});

test("an empty storage reads as null", () => {
  const { storage } = createFakeStorage();

  expect(createMarksCache(() => storage).read()).toBeNull();
});

test("a value without an owner reads as null", () => {
  const { storage } = createFakeStorage({ "traviz-marks-v2": "DEU=visited" });

  expect(createMarksCache(() => storage).read()).toBeNull();
});

test("a value that is not the cache format reads as null", () => {
  const { storage } = createFakeStorage({ "traviz-marks-v2": '{"ownerId":"user_a"}' });

  expect(createMarksCache(() => storage).read()).toBeNull();
});

test("a mark outside the country states reads as null", () => {
  const { storage } = createFakeStorage({
    "traviz-marks-v2": "ownerId=user_a&DEU=visited&FRA=maybe",
  });

  expect(createMarksCache(() => storage).read()).toBeNull();
});

test("writing removes the retired traviz-marks key", () => {
  const { storage, items } = createFakeStorage(RETIRED);

  createMarksCache(() => storage).write({ ownerId: "user_a", marks: {} });

  expect(Object.keys(items())).toEqual(["traviz-marks-v2"]);
});

test("clearing removes the cache and the retired traviz-marks key", () => {
  const { storage, items } = createFakeStorage(RETIRED);
  const cache = createMarksCache(() => storage);
  cache.write({ ownerId: "user_a", marks: { DEU: "visited" } });
  storage.setItem("traviz-marks", RETIRED["traviz-marks"]);

  cache.clear();

  expect(items()).toEqual({});
});

test("a storage that throws lets the error through for the owner to swallow", () => {
  const cache = createMarksCache(() => {
    throw new Error("storage blocked");
  });

  expect(() => cache.read()).toThrow("storage blocked");
  expect(() => cache.write({ ownerId: "user_a", marks: {} })).toThrow("storage blocked");
  expect(() => cache.clear()).toThrow("storage blocked");
});
