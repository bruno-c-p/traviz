import {
  DISMISS_BUTTON_CLASS,
  DISMISS_ICON_CLASS,
  PROBLEM_STATUS_CLASS,
  PROBLEM_TEXT_CLASS,
  ROW_HEIGHT,
  SAVING_STATUS_CLASS,
  barTransform,
  chipClass,
  countClass,
  filterClass,
  sidebarItemClass,
  sidebarLabelClass,
} from "@/features/country-list/list-classes";
import {
  continentOptions,
  decodeListRows,
  listLayout,
  parseListFilter,
  stateCounts,
  toggledFilters,
} from "@/features/country-list/list-model";
import type { ListRow, ListSelection } from "@/features/country-list/list-model";
import { COUNTRY_STATES, markStatusText } from "@/features/marks";
import type { CountryState, MarksStore, MarksStoreState } from "@/features/marks";

const MATERIALIZE_CHUNK = 40;

type RowView = {
  readonly row: ListRow;
  element: HTMLElement | null;
  buttons: readonly HTMLButtonElement[];
  textBox: HTMLElement | null;
  shownState: CountryState | undefined;
  statusKey: string;
};

type SectionView = {
  readonly continent: string;
  readonly element: HTMLElement;
  readonly header: Element | null;
  readonly count: Element | null;
};

function find<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);

  if (element === null) throw new Error(`The list view has no ${selector}.`);

  return element;
}

function setText(element: Element | null, text: string) {
  if (element !== null && element.textContent !== text) element.textContent = text;
}

function setPressed(element: Element, isPressed: boolean) {
  const value = isPressed ? "true" : "false";

  if (element.getAttribute("aria-pressed") !== value) element.setAttribute("aria-pressed", value);
}

function setClass(element: Element | null, className: string) {
  if (element !== null && element.className !== className) element.className = className;
}

function parseCountryState(value: string | undefined): CountryState | undefined {
  return COUNTRY_STATES.find((countryState) => countryState === value);
}

function place(parent: Element, after: Element | null, desired: readonly Element[]) {
  const wanted = new Set(desired);
  const first = () => (after === null ? parent.firstElementChild : after.nextElementSibling);

  for (let node = first(); node !== null;) {
    const following = node.nextElementSibling;

    if (!wanted.has(node)) node.remove();

    node = following;
  }

  let cursor = first();

  for (const element of desired) {
    if (cursor === element) cursor = cursor.nextElementSibling;
    else parent.insertBefore(element, cursor);
  }
}

function adoptRow(view: RowView, element: HTMLElement) {
  view.element = element;
  view.buttons = [...element.querySelectorAll<HTMLButtonElement>("button[data-state]")];
  view.textBox = element.querySelector<HTMLElement>("[data-row-text]");

  view.shownState = parseCountryState(
    view.buttons.find((button) => button.getAttribute("aria-pressed") === "true")?.dataset.state,
  );
}

function showState(view: RowView, state: CountryState | undefined) {
  if (view.shownState === state) return;

  view.shownState = state;

  for (const button of view.buttons) setPressed(button, button.dataset.state === state);
}

function statusElement(view: RowView, status: NonNullable<ReturnType<typeof markStatusText>>) {
  const paragraph = document.createElement("p");

  paragraph.setAttribute("role", "status");
  paragraph.dataset.rowStatus = "";

  if (status.kind === "saving") {
    paragraph.className = SAVING_STATUS_CLASS;
    paragraph.textContent = status.text;

    return paragraph;
  }

  const text = document.createElement("span");
  const dismiss = document.createElement("button");
  const icon = document.createElement("span");

  paragraph.className = PROBLEM_STATUS_CLASS;
  text.className = PROBLEM_TEXT_CLASS;
  text.textContent = status.text;
  dismiss.type = "button";
  dismiss.dataset.dismiss = view.row.code;
  dismiss.setAttribute("aria-label", "Dismiss");
  dismiss.className = DISMISS_BUTTON_CLASS;
  icon.setAttribute("aria-hidden", "true");
  icon.className = DISMISS_ICON_CLASS;
  dismiss.append(icon);
  paragraph.append(text, dismiss);

  return paragraph;
}

function showStatus(view: RowView, state: MarksStoreState) {
  const status = markStatusText(view.row.code, state.saving, state.problems);
  const statusKey = status === null ? "" : `${status.kind}:${status.text}`;

  if (view.statusKey === statusKey || view.textBox === null) return;

  view.statusKey = statusKey;
  view.textBox.querySelector("[data-row-status]")?.remove();

  if (status !== null) view.textBox.append(statusElement(view, status));
}

export function mountListView(host: HTMLElement, store: MarksStore) {
  const rows = decodeListRows(find(host, "[data-list-rows]").textContent ?? "");
  const card = find<HTMLElement>(host, "[data-list-card]");
  const resultsBox = find<HTMLElement>(host, "[data-list-results]");
  const emptyMessage = find<HTMLElement>(host, "[data-list-empty]");
  const heading = find<HTMLElement>(host, "[data-list-heading]");
  const searchInput = find<HTMLInputElement>(host, "input[data-list-search]");
  const clearButton = find<HTMLButtonElement>(host, "button[data-list-clear]");
  const rowTemplate = find<HTMLTemplateElement>(host, "template[data-row-template]");
  const chipButtons = [...host.querySelectorAll<HTMLElement>("[data-list-chips] button")];
  const sidebarButtons = [...host.querySelectorAll<HTMLElement>("[data-list-sidebar] button")];
  const filterButtons = [...host.querySelectorAll<HTMLElement>("[data-list-filters] button")];

  const views: RowView[] = rows.map((row) => ({
    row,
    element: null,
    buttons: [],
    textBox: null,
    shownState: undefined,
    statusKey: "",
  }));

  const viewsByCode = new Map(views.map((view) => [view.row.code, view]));

  const sections: SectionView[] = [
    ...card.querySelectorAll<HTMLElement>("[data-list-section]"),
  ].map((element) => ({
    continent: element.dataset.listSection ?? "",
    element,
    header: element.firstElementChild,
    count: element.querySelector("[data-count]"),
  }));

  const sectionsByContinent = new Map(sections.map((section) => [section.continent, section]));

  let selection: ListSelection = { continent: null, filters: new Set(), query: "" };
  let nextToMaterialize = 0;
  let isArranged = false;

  for (const element of card.querySelectorAll<HTMLElement>("[data-row]")) {
    const view = viewsByCode.get(
      element.querySelector<HTMLElement>("[data-code]")?.dataset.code ?? "",
    );

    if (view !== undefined) adoptRow(view, element);
  }

  const createRow = (view: RowView): HTMLElement | null => {
    const element = rowTemplate.content.firstElementChild?.cloneNode(true);

    if (!(element instanceof HTMLElement)) return null;

    const group = element.querySelector<HTMLElement>("[data-code]");

    setText(element.querySelector("[data-row-code]"), view.row.code);
    setText(element.querySelector("[data-row-name]"), view.row.name);
    group?.setAttribute("aria-label", `Mark ${view.row.name}`);
    group?.setAttribute("data-code", view.row.code);

    if (!view.row.isTerritory) element.querySelector("[data-row-territory]")?.remove();

    adoptRow(view, element);
    showState(view, store.getState().marks[view.row.code]);
    showStatus(view, store.getState());

    return element;
  };

  const deferredCounts = new Map(
    sections.map((section) => [
      section,
      views.filter((view) => view.row.continent === section.continent && view.element === null)
        .length,
    ]),
  );

  const insertBatch = (section: SectionView, batch: DocumentFragment, added: number) => {
    const spacer = section.element.querySelector<HTMLElement>("[data-row-spacer]");
    const remaining = (deferredCounts.get(section) ?? 0) - added;

    deferredCounts.set(section, remaining);

    if (spacer === null) {
      section.element.append(batch);

      return;
    }

    spacer.before(batch);

    if (remaining > 0) spacer.style.height = `${remaining * ROW_HEIGHT}px`;
    else spacer.remove();
  };

  const buildNextRow = (): { section: SectionView; element: HTMLElement } | null => {
    const view = views[nextToMaterialize];

    nextToMaterialize += 1;

    if (view === undefined || view.element !== null) return null;

    const section = sectionsByContinent.get(view.row.continent);
    const element = section === undefined ? null : createRow(view);

    return section === undefined || element === null ? null : { section, element };
  };

  const materialize = (limit: number) => {
    const batches = new Map<SectionView, { fragment: DocumentFragment; added: number }>();
    let created = 0;

    while (nextToMaterialize < views.length && created < limit) {
      const built = buildNextRow();

      if (built === null) continue;

      const batch = batches.get(built.section) ?? {
        fragment: document.createDocumentFragment(),
        added: 0,
      };

      batch.fragment.append(built.element);
      batch.added += 1;
      batches.set(built.section, batch);
      created += 1;
    }

    for (const [section, batch] of batches) insertBatch(section, batch.fragment, batch.added);
  };

  const materializeAll = () => {
    if (nextToMaterialize < views.length) materialize(Infinity);
  };

  const elementsOf = (list: readonly ListRow[]): Element[] =>
    list.flatMap((row) => viewsByCode.get(row.code)?.element ?? []);

  const renderLayout = () => {
    materializeAll();

    const layout = listLayout(rows, store.getState().marks, selection);
    const shownSections: Element[] = [];

    setText(heading, layout.heading);

    for (const section of layout.sections) {
      const view = sectionsByContinent.get(section.continent);

      if (view === undefined) continue;

      place(view.element, view.header, elementsOf(section.rows));
      setText(view.count, String(section.rows.length));
      shownSections.push(view.element);
    }

    place(resultsBox, null, elementsOf(layout.results ?? []));
    place(card, null, [...shownSections, resultsBox, emptyMessage]);
    emptyMessage.hidden = layout.emptyMessage === null;
    setText(emptyMessage, layout.emptyMessage ?? "");
    isArranged = true;
  };

  const renderCounts = () => {
    const { marks } = store.getState();
    const counts = stateCounts(rows, marks, selection.continent);
    const options = continentOptions(rows, marks);

    for (const button of filterButtons) {
      const filter = parseListFilter(button.dataset.filter);

      if (filter !== null) setText(button.querySelector("[data-count]"), String(counts[filter]));
    }

    options.forEach((option, index) => {
      const chip = chipButtons[index];
      const item = sidebarButtons[index];

      setText(chip?.querySelector("[data-count]") ?? null, `${option.visited}/${option.total}`);
      setText(item?.querySelector("[data-count]") ?? null, `${option.visited} / ${option.total}`);
      item
        ?.querySelector<HTMLElement>("[data-bar]")
        ?.style.setProperty("transform", barTransform(option.visited, option.total));
    });
  };

  const isSelectedContinent = (button: HTMLElement) =>
    (button.dataset.continent ?? "") === (selection.continent ?? "");

  const renderContinentButtons = () => {
    for (const chip of chipButtons) {
      const isActive = isSelectedContinent(chip);

      setPressed(chip, isActive);
      setClass(chip, chipClass(isActive));
      setClass(chip.querySelector("[data-count]"), countClass(isActive));
    }

    for (const item of sidebarButtons) {
      const isActive = isSelectedContinent(item);

      setPressed(item, isActive);
      setClass(item, sidebarItemClass(isActive));
      setClass(item.querySelector("[data-label]"), sidebarLabelClass(isActive));
    }
  };

  const renderSelection = () => {
    renderContinentButtons();

    for (const button of filterButtons) {
      const filter = parseListFilter(button.dataset.filter);
      const isActive = filter !== null && selection.filters.has(filter);

      setPressed(button, isActive);
      setClass(button, filterClass(isActive));
      setClass(button.querySelector("[data-count]"), countClass(isActive));
    }

    clearButton.hidden = selection.query === "";
  };

  const select = (changes: Partial<ListSelection>) => {
    selection = { ...selection, ...changes };
    renderSelection();
    renderCounts();
    renderLayout();
  };

  const renderMarks = () => {
    const { marks } = store.getState();

    for (const view of views) {
      if (view.element !== null) showState(view, marks[view.row.code]);
    }

    renderCounts();

    if (isArranged && selection.filters.size > 0) renderLayout();
  };

  const renderStatuses = () => {
    const state = store.getState();

    for (const view of views) {
      if (view.element !== null) showStatus(view, state);
    }
  };

  const toggleMark = (code: string, state: CountryState) => {
    const { marks, mark, clear } = store.getState();

    if (marks[code] === state) clear(code);
    else mark(code, state);
  };

  const toggleTappedMark = (button: HTMLButtonElement): boolean => {
    const state = parseCountryState(button.dataset.state);
    const code = button.parentElement?.dataset.code;

    if (state === undefined || code === undefined) return false;

    toggleMark(code, state);

    return true;
  };

  const useControl = (button: HTMLButtonElement) => {
    const filter = parseListFilter(button.dataset.filter);
    const { continent, dismiss } = button.dataset;

    if (filter !== null) select({ filters: toggledFilters(selection.filters, filter) });
    else if (continent !== undefined) select({ continent: continent === "" ? null : continent });
    else if (dismiss !== undefined) store.getState().dismissProblem(dismiss);
    else if (button === clearButton) {
      searchInput.value = "";
      searchInput.focus();
      select({ query: "" });
    }
  };

  host.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest("button") : null;

    if (button !== null && !toggleTappedMark(button)) useControl(button);
  });

  searchInput.addEventListener("input", () => select({ query: searchInput.value }));

  store.subscribe((state, previousState) => {
    if (state.marks !== previousState.marks) renderMarks();

    if (state.saving !== previousState.saving || state.problems !== previousState.problems) {
      renderStatuses();
    }
  });

  const materializeInChunks = () => {
    materialize(MATERIALIZE_CHUNK);

    if (nextToMaterialize < views.length) setTimeout(materializeInChunks, 0);
  };

  requestAnimationFrame(() => setTimeout(materializeInChunks, 0));
  host.closest("[data-panel-scroll]")?.addEventListener("scroll", materializeAll, {
    once: true,
    passive: true,
  });

  renderMarks();
  renderStatuses();

  if (searchInput.value !== "") select({ query: searchInput.value });

  return { showView: () => {}, hideView: () => {} };
}
