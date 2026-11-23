import { expect, test } from "bun:test";
import { SAMPLE_MARKS } from "@/features/landing/landing-marks";
import { createLandingStore } from "@/features/landing/landing-store";

test("starts from the sample with nothing in focus", () => {
  const state = createLandingStore().getState();

  expect(state.marks).toEqual(SAMPLE_MARKS);
  expect(state.focus).toBeNull();
  expect(state.isSample).toBe(true);
});

test("a pick cycles the mark, focuses the country and ends the sample", () => {
  const store = createLandingStore();

  store.getState().pick("BRA");
  store.getState().pick("BRA");

  expect(store.getState().marks.BRA).toBe("want");
  expect(store.getState().focus).toEqual({ code: "BRA", id: 2 });
  expect(store.getState().isSample).toBe(false);
});

test("clear removes every mark and keeps the last focus", () => {
  const store = createLandingStore();

  store.getState().pick("BRA");
  store.getState().clear();

  expect(store.getState().marks).toEqual({});
  expect(store.getState().focus).toEqual({ code: "BRA", id: 1 });
});

test("each store keeps its own marks", () => {
  const first = createLandingStore();

  first.getState().pick("BRA");

  expect(createLandingStore().getState().marks).toEqual(SAMPLE_MARKS);
});
