import { describe, expect, test } from "bun:test";
import {
  CLOSED_SEARCH,
  pressSearchKey,
  showsResults,
  typeQuery,
} from "@/features/globe/country-search-state";

describe("country search state", () => {
  test("shows results only while open with a query that is not blank", () => {
    expect(showsResults(CLOSED_SEARCH)).toBe(false);
    expect(showsResults({ query: "  ", isOpen: true, activeIndex: 0 })).toBe(false);
    expect(showsResults({ query: "jap", isOpen: false, activeIndex: 0 })).toBe(false);
    expect(showsResults(typeQuery("jap"))).toBe(true);
  });

  test("typing opens the list and puts the first result back in focus", () => {
    expect(typeQuery("ja")).toEqual({ query: "ja", isOpen: true, activeIndex: 0 });
  });

  test("ArrowDown opens a closed list and moves down, stopping at the last result", () => {
    const closed = { query: "uni", isOpen: false, activeIndex: 0 };
    const first = pressSearchKey(closed, "ArrowDown", 3);
    const second = pressSearchKey(first.state, "ArrowDown", 3);
    const third = pressSearchKey(second.state, "ArrowDown", 3);

    expect(first).toEqual({
      state: { query: "uni", isOpen: true, activeIndex: 1 },
      chosenIndex: null,
      isHandled: true,
    });
    expect(second.state.activeIndex).toBe(2);
    expect(third.state.activeIndex).toBe(2);
  });

  test("ArrowDown with no results keeps the first position", () => {
    expect(pressSearchKey(typeQuery("zzzz"), "ArrowDown", 0).state.activeIndex).toBe(0);
  });

  test("ArrowUp moves up and stops at the first result", () => {
    const state = { query: "uni", isOpen: true, activeIndex: 1 };
    const up = pressSearchKey(state, "ArrowUp", 3);

    expect(up.state.activeIndex).toBe(0);
    expect(up.isHandled).toBe(true);
    expect(pressSearchKey(up.state, "ArrowUp", 3).state.activeIndex).toBe(0);
  });

  test("Enter chooses the active result and closes with an empty query", () => {
    expect(pressSearchKey({ query: "uni", isOpen: true, activeIndex: 2 }, "Enter", 3)).toEqual({
      state: CLOSED_SEARCH,
      chosenIndex: 2,
      isHandled: true,
    });
  });

  test("Enter does nothing when the list is closed or has no result", () => {
    const closed = { query: "uni", isOpen: false, activeIndex: 0 };

    expect(pressSearchKey(closed, "Enter", 3)).toEqual({
      state: closed,
      chosenIndex: null,
      isHandled: false,
    });
    expect(pressSearchKey(typeQuery("zzzz"), "Enter", 0).chosenIndex).toBeNull();
  });

  test("Escape closes the list, keeps the query and lets the key reach the page", () => {
    expect(pressSearchKey(typeQuery("uni"), "Escape", 3)).toEqual({
      state: { query: "uni", isOpen: false, activeIndex: 0 },
      chosenIndex: null,
      isHandled: false,
    });
  });

  test("any other key leaves the state alone", () => {
    const state = typeQuery("uni");

    expect(pressSearchKey(state, "a", 3)).toEqual({ state, chosenIndex: null, isHandled: false });
  });
});
