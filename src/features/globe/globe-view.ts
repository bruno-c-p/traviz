import { mountCountrySearch } from "@/features/globe/country-search";
import { mountCountrySheet } from "@/features/globe/country-sheet";
import { countryMeta, decodeGlobeCountries } from "@/features/globe/globe-countries";
import type { GlobeCountry } from "@/features/globe/globe-countries";
import { GLOBE_ENGINE_EVENT } from "@/features/globe/globe-engine-contract";
import type { GlobeEngine, RunningGlobe } from "@/features/globe/globe-engine-contract";
import type { GlobeStores } from "@/features/globe/globe-stores";
import { activateLazyScript } from "@/features/globe/lazy-script";
import { createSelectionStore } from "@/features/globe/selected-country";
import { mountMarkControls } from "@/features/marks";
import type { Marks, MarksStore } from "@/features/marks";
import { renderProgressCards } from "@/features/stats";
import type { MountedView } from "@/shared/view";

const ENGINE_SCRIPT_NAME = "globe-engine";

export type GlobeViewOptions = {
  readonly marks: MarksStore;
  readonly subscribeTheme: GlobeStores["subscribeTheme"];
};

type CountryPanel = {
  readonly name: HTMLElement | null;
  readonly meta: HTMLElement | null;
  readonly closeButton: HTMLElement | null;
  readonly controls: ReturnType<typeof mountMarkControls>;
};

function setText(element: Element | null, text: string) {
  if (element !== null && element.textContent !== text) element.textContent = text;
}

function countryPanel(root: HTMLElement, marks: MarksStore): CountryPanel {
  return {
    name: root.querySelector<HTMLElement>("[data-country-name]"),
    meta: root.querySelector<HTMLElement>("[data-country-meta]"),
    closeButton: root.querySelector<HTMLElement>("[data-country-close]"),
    controls: mountMarkControls(root, marks),
  };
}

function showCountry(panel: CountryPanel, country: GlobeCountry) {
  setText(panel.name, country.name);
  setText(panel.meta, countryMeta(country));
  panel.controls.showCountry(country.code, country.name);
}

function moveSearchToTopBar(host: HTMLElement) {
  const tools = host.querySelector<HTMLElement>("[data-globe-top-tools]");
  const slot = document.querySelector<HTMLElement>("[data-top-bar-globe-tools]");

  if (tools === null || slot === null) return;

  slot.append(...tools.children);
  tools.remove();
}

export function mountGlobeView(host: HTMLElement, options: GlobeViewOptions): MountedView {
  const container = host.querySelector<HTMLElement>("[data-globe-host]");
  const card = host.querySelector<HTMLElement>("[data-country-card]");
  const hint = host.querySelector<HTMLElement>("[data-globe-hint]");
  const sheetWrapper = host.querySelector<HTMLElement>("[data-country-sheet]");
  const selection = createSelectionStore();

  const stores: GlobeStores = {
    marks: options.marks,
    selection,
    subscribeTheme: options.subscribeTheme,
  };

  const countries = decodeGlobeCountries(
    host.querySelector("[data-globe-countries]")?.textContent ?? "",
  );

  const countriesByCode = new Map(countries.map((country) => [country.code, country]));
  const clearSelection = () => selection.getState().clearSelection();
  const sheet = sheetWrapper === null ? null : mountCountrySheet(sheetWrapper, clearSelection);
  const cardPanel = card === null ? null : countryPanel(card, options.marks);
  const sheetPanel = sheetWrapper === null ? null : countryPanel(sheetWrapper, options.marks);

  let globe: RunningGlobe | null = null;
  let isStarting = false;
  let isShown = false;
  let shownMarks: Marks | null = null;

  const renderProgress = () => {
    const { marks } = options.marks.getState();

    if (marks === shownMarks) return;

    shownMarks = marks;
    renderProgressCards(host, countries, marks);
  };

  const renderSelection = () => {
    const country = countriesByCode.get(selection.getState().selectedCode ?? "");

    if (card !== null) card.hidden = country === undefined;

    if (hint !== null) hint.hidden = country !== undefined;

    if (country !== undefined) {
      if (cardPanel !== null) showCountry(cardPanel, country);

      if (sheetPanel !== null) showCountry(sheetPanel, country);
    }

    if (country !== undefined && isShown) sheet?.show();
    else sheet?.hide();
  };

  const startEngine = (engine: GlobeEngine) => {
    if (isStarting || container === null) return;

    isStarting = true;
    engine
      .start(container, stores)
      .then((running) => {
        globe = running;

        if (!isShown) running.pause();
      })
      .catch((cause: unknown) => {
        isStarting = false;
        console.error("The globe could not start.", cause);
      });
  };

  const startEngineWhenShown = () => {
    if (isShown && window.travizGlobeEngine !== undefined) startEngine(window.travizGlobeEngine);
  };

  const requestEngine = () => {
    if (window.travizGlobeEngine !== undefined) {
      startEngine(window.travizGlobeEngine);

      return;
    }

    document.addEventListener(GLOBE_ENGINE_EVENT, startEngineWhenShown, { once: true });
    activateLazyScript(host, ENGINE_SCRIPT_NAME);
  };

  for (const search of host.querySelectorAll<HTMLElement>("[data-country-search]")) {
    mountCountrySearch(search, countries, (code) => selection.getState().selectAndFly(code));
  }

  moveSearchToTopBar(host);

  if (sheetWrapper !== null) document.body.append(sheetWrapper);

  cardPanel?.closeButton?.addEventListener("click", clearSelection);
  sheetPanel?.closeButton?.addEventListener("click", () => sheet?.close());

  host.addEventListener("click", (event) => {
    const zoom =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>("[data-zoom]")?.dataset.zoom
        : undefined;

    if (zoom === "in") globe?.zoomIn();
    else if (zoom === "out") globe?.zoomOut();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isShown && selection.getState().selectedCode !== null) {
      clearSelection();
    }
  });

  selection.subscribe((state, previousState) => {
    if (state.selectedCode !== previousState.selectedCode) renderSelection();
  });

  options.marks.subscribe(() => {
    if (isShown) renderProgress();
  });

  return {
    showView: () => {
      isShown = true;
      renderProgress();
      renderSelection();
      globe?.resume();
      requestEngine();
    },
    hideView: () => {
      isShown = false;
      globe?.pause();
      renderSelection();
    },
  };
}
