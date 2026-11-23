import { loadPreviewGlobe } from "@/features/globe/core";
import { SAMPLE_CENTER } from "@/features/landing/landing-marks";
import { createLandingStore } from "@/features/landing/landing-store";
import type { LandingStore } from "@/features/landing/landing-store";
import { renderLanding } from "@/features/landing/render-landing";
import type { WallEntry } from "@/features/landing/render-landing";
import { nextWallIndex } from "@/features/landing/wall-keys";

function readWall(wall: HTMLElement): WallEntry[] {
  return [...wall.querySelectorAll<HTMLButtonElement>("button[data-pick]")].map((button) => ({
    button,
    code: button.dataset.pick ?? "",
    name: button.firstChild?.textContent?.trim() ?? "",
    continent: button.dataset.continent ?? "",
    flag: button.dataset.flag ?? "",
  }));
}

function bindPicks(store: LandingStore) {
  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;

    const code = event.target.closest<HTMLElement>("[data-pick]")?.dataset.pick;

    if (code) store.getState().pick(code);
    else if (event.target.closest("[data-clear]")) store.getState().clear();
  });
}

function bindWallKeys(wall: HTMLElement, buttons: readonly HTMLButtonElement[]) {
  let tabStop = 0;

  function moveTabStop(index: number) {
    buttons[tabStop]?.setAttribute("tabindex", "-1");
    buttons[index]?.setAttribute("tabindex", "0");
    tabStop = index;
  }

  wall.addEventListener("focusin", (event) => {
    const index = buttons.findIndex((button) => button === event.target);

    if (index >= 0) moveTabStop(index);
  });

  wall.addEventListener("keydown", (event) => {
    const next = nextWallIndex(
      event.key,
      tabStop,
      buttons.map((button) => button.getBoundingClientRect()),
    );

    if (next === null) return;

    event.preventDefault();
    moveTabStop(next);
    buttons[next]?.focus();
  });
}

function startGlobe(store: LandingStore) {
  const container = document.querySelector<HTMLElement>("[data-globe]");

  if (!container) return;

  loadPreviewGlobe(container, {
    initialCenter: SAMPLE_CENTER,
    marks: () => store.getState().marks,
  })
    .then((preview) => {
      if (!preview) return;

      store.subscribe((state, previous) => {
        preview.setMarks(state.marks);

        if (state.focus && state.focus !== previous.focus) preview.focus(state.focus.code);
      });
    })
    .catch((cause: unknown) => {
      console.error("The preview globe could not start.", cause);
    });
}

export function startLanding() {
  const wallElement = document.querySelector<HTMLElement>("[data-wall]");

  if (!wallElement) return;

  const wall = readWall(wallElement);
  const store = createLandingStore();

  store.subscribe((state, previous) => renderLanding(wall, previous, state));
  bindPicks(store);
  bindWallKeys(
    wallElement,
    wall.map((entry) => entry.button),
  );
  startGlobe(store);
}
