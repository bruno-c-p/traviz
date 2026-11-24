export type SearchState = {
  readonly query: string;
  readonly isOpen: boolean;
  readonly activeIndex: number;
};

export type SearchKeyOutcome = {
  readonly state: SearchState;
  readonly chosenIndex: number | null;
  readonly isHandled: boolean;
};

export const CLOSED_SEARCH: SearchState = { query: "", isOpen: false, activeIndex: 0 };

export function showsResults(state: SearchState): boolean {
  return state.isOpen && state.query.trim().length > 0;
}

export function typeQuery(query: string): SearchState {
  return { query, isOpen: true, activeIndex: 0 };
}

export function pressSearchKey(
  state: SearchState,
  key: string,
  resultCount: number,
): SearchKeyOutcome {
  if (key === "ArrowDown") {
    return {
      state: {
        ...state,
        isOpen: true,
        activeIndex: Math.max(Math.min(state.activeIndex + 1, resultCount - 1), 0),
      },
      chosenIndex: null,
      isHandled: true,
    };
  }

  if (key === "ArrowUp") {
    return {
      state: { ...state, activeIndex: Math.max(state.activeIndex - 1, 0) },
      chosenIndex: null,
      isHandled: true,
    };
  }

  if (key === "Enter" && showsResults(state) && state.activeIndex < resultCount) {
    return { state: CLOSED_SEARCH, chosenIndex: state.activeIndex, isHandled: true };
  }

  if (key === "Escape") {
    return { state: { ...state, isOpen: false }, chosenIndex: null, isHandled: false };
  }

  return { state, chosenIndex: null, isHandled: false };
}
