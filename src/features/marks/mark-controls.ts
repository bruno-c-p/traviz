import { COUNTRY_STATES } from "@/features/marks/colors";
import type { CountryState } from "@/features/marks/colors";
import { markStatusText } from "@/features/marks/mark-status";
import type { MarksStore } from "@/features/marks/marks-store";

const SAVING_TEXT_CLASS = "text-mute";
const PROBLEM_TEXT_CLASS = "text-negative-text";

function parseCountryState(value: string | undefined): CountryState | undefined {
  return COUNTRY_STATES.find((countryState) => countryState === value);
}

function pressedButton(event: Event): HTMLButtonElement | null {
  return event.target instanceof Element ? event.target.closest("button") : null;
}

export function mountMarkControls(root: HTMLElement, store: MarksStore) {
  const group = root.querySelector<HTMLElement>("[data-mark-choices]");
  const choices = [...root.querySelectorAll<HTMLButtonElement>("button[data-state]")];
  const clearButton = root.querySelector<HTMLButtonElement>("button[data-clear-mark]");
  const status = root.querySelector<HTMLElement>("[data-mark-status]");
  const statusText = status?.querySelector<HTMLElement>("[data-status-text]") ?? null;
  const dismissButton = status?.querySelector<HTMLButtonElement>("[data-status-dismiss]") ?? null;
  let shownCode: string | null = null;

  const render = () => {
    if (shownCode === null) return;

    const { marks, saving, problems } = store.getState();
    const shownState = marks[shownCode];
    const markStatus = markStatusText(shownCode, saving, problems);

    for (const choice of choices) {
      choice.setAttribute("aria-pressed", choice.dataset.state === shownState ? "true" : "false");
    }

    if (clearButton !== null) clearButton.hidden = shownState === undefined;

    if (status === null || statusText === null || dismissButton === null) return;

    status.hidden = markStatus === null;
    statusText.textContent = markStatus?.text ?? "";
    dismissButton.hidden = markStatus?.kind !== "problem";
    status.classList.toggle(SAVING_TEXT_CLASS, markStatus?.kind !== "problem");
    status.classList.toggle(PROBLEM_TEXT_CLASS, markStatus?.kind === "problem");
  };

  root.addEventListener("click", (event) => {
    const button = pressedButton(event);
    const { marks, mark, clear, dismissProblem } = store.getState();

    if (button === null || shownCode === null || !root.contains(button)) return;

    const choice = parseCountryState(button.dataset.state);

    if (choice !== undefined && marks[shownCode] === choice) clear(shownCode);
    else if (choice !== undefined) mark(shownCode, choice);
    else if (button === clearButton) clear(shownCode);
    else if (button === dismissButton) dismissProblem(shownCode);
  });

  store.subscribe(render);

  return {
    showCountry: (code: string, name: string) => {
      shownCode = code;
      group?.setAttribute("data-code", code);
      group?.setAttribute("aria-label", `Mark ${name}`);
      render();
    },
  };
}
