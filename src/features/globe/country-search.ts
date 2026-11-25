import {
  CLOSED_SEARCH,
  pressSearchKey,
  showsResults,
  typeQuery,
} from "@/features/globe/country-search-state";
import type { SearchState } from "@/features/globe/country-search-state";
import { searchGlobeCountries } from "@/features/globe/globe-countries";
import type { GlobeCountry } from "@/features/globe/globe-countries";
import { cn } from "@/shared/cn";

const OPTION_CLASS = "flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3";
const ACTIVE_OPTION_CLASS = "bg-canvas-soft";
const EMPTY_OPTION_CLASS = "px-3 py-3 text-sm text-body";
const CODE_CLASS = "w-9 shrink-0 font-mono text-xs text-mute";
const NAME_CLASS = "min-w-0 flex-1 truncate text-[15px] font-medium text-ink";
const CONTINENT_CLASS = "shrink-0 text-xs text-mute";

function textSpan(className: string, text: string): HTMLSpanElement {
  const span = document.createElement("span");

  span.className = className;
  span.textContent = text;

  return span;
}

function resultOption(listboxId: string, country: GlobeCountry): HTMLLIElement {
  const option = document.createElement("li");

  option.id = `${listboxId}-${country.code}`;
  option.dataset.code = country.code;
  option.setAttribute("role", "option");
  option.append(
    textSpan(CODE_CLASS, country.code),
    textSpan(NAME_CLASS, country.name),
    textSpan(CONTINENT_CLASS, country.continent),
  );

  return option;
}

function emptyOption(query: string): HTMLLIElement {
  const option = document.createElement("li");

  option.setAttribute("role", "option");
  option.setAttribute("aria-selected", "false");
  option.setAttribute("aria-disabled", "true");
  option.className = EMPTY_OPTION_CLASS;
  option.textContent = `No countries match “${query.trim()}”.`;

  return option;
}

function optionAt(event: Event): HTMLElement | null {
  return event.target instanceof Element
    ? event.target.closest<HTMLElement>("li[data-code]")
    : null;
}

export function mountCountrySearch(
  root: HTMLElement,
  countries: readonly GlobeCountry[],
  onChoose: (code: string) => void,
) {
  const input = root.querySelector<HTMLInputElement>("input");
  const listbox = root.querySelector<HTMLElement>('[role="listbox"]');

  if (input === null || listbox === null) return;

  let state: SearchState = CLOSED_SEARCH;
  let results: GlobeCountry[] = [];
  let options: HTMLLIElement[] = [];
  let listedQuery: string | null = null;

  const listResults = () => {
    if (listedQuery === state.query) return;

    listedQuery = state.query;
    options = results.map((country) => resultOption(listbox.id, country));
    listbox.replaceChildren(...(options.length === 0 ? [emptyOption(state.query)] : options));
  };

  const render = () => {
    const isShowing = showsResults(state);

    input.setAttribute("aria-expanded", isShowing ? "true" : "false");
    listbox.hidden = !isShowing;

    if (isShowing) listResults();

    options.forEach((option, index) => {
      const isActive = index === state.activeIndex;

      option.className = cn(OPTION_CLASS, isActive && ACTIVE_OPTION_CLASS);
      option.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    const activeOption = isShowing ? options[state.activeIndex] : undefined;

    if (activeOption === undefined) input.removeAttribute("aria-activedescendant");
    else input.setAttribute("aria-activedescendant", activeOption.id);
  };

  const update = (nextState: SearchState) => {
    if (nextState.query !== state.query) results = searchGlobeCountries(countries, nextState.query);

    state = nextState;
    render();
  };

  const choose = (code: string) => {
    onChoose(code);
    input.value = "";
    update(CLOSED_SEARCH);
  };

  input.addEventListener("input", () => update(typeQuery(input.value)));
  input.addEventListener("focus", () => update({ ...state, isOpen: true }));
  input.addEventListener("blur", () => update({ ...state, isOpen: false }));

  input.addEventListener("keydown", (event) => {
    const outcome = pressSearchKey(state, event.key, results.length);
    const chosen = outcome.chosenIndex === null ? undefined : results[outcome.chosenIndex];

    if (outcome.isHandled) event.preventDefault();

    if (chosen === undefined) update(outcome.state);
    else choose(chosen.code);
  });

  listbox.addEventListener("mousedown", (event) => {
    const code = optionAt(event)?.dataset.code;

    event.preventDefault();

    if (code !== undefined) choose(code);
  });

  listbox.addEventListener("mouseover", (event) => {
    const option = optionAt(event);
    const index = options.findIndex((candidate) => candidate === option);

    if (index >= 0 && index !== state.activeIndex) update({ ...state, activeIndex: index });
  });

  if (input.value !== "") {
    update({ ...typeQuery(input.value), isOpen: document.activeElement === input });
  }
}
