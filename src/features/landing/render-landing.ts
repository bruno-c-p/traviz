import {
  CELL_CLASS,
  CELL_FILLS,
  LAST_PICK_CLASS,
  LAST_PICK_CLEARED_CLASS,
  LIST_STATE_CLASS,
  NAME_PAINT_CLASS,
  STATE_CHIP_CLASS,
  STATE_FILLS,
} from "@/features/landing/landing-classes";
import { nextState } from "@/features/landing/landing-marks";
import type { LandingState } from "@/features/landing/landing-store";
import {
  cellStates,
  changedCodes,
  clearLabel,
  listRows,
  stateSuffix,
  tallyAnnouncement,
} from "@/features/landing/landing-view";
import type { WallCountry } from "@/features/landing/landing-view";
import {
  COUNTRY_STATES,
  STATE_COLORS,
  STATE_LABELS,
  tallyMarks,
  tallyShare,
} from "@/features/marks/core";
import type { CountryState, Marks } from "@/features/marks/core";
import { cn } from "@/shared/cn";

export type WallEntry = WallCountry & { button: HTMLButtonElement };

function elements(selector: string): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(selector)];
}

function setText(root: ParentNode, selector: string, text: string) {
  const element = root.querySelector(selector);

  if (element) element.textContent = text;
}

function stateNamed(name: string | undefined): CountryState | undefined {
  return COUNTRY_STATES.find((state) => state === name);
}

function paintName(entry: WallEntry, state: CountryState | undefined) {
  const label = entry.button.querySelector("[data-state-label]");

  entry.button.dataset.next = nextState(state) ?? "unmarked";
  entry.button.querySelector("[data-paint]")?.remove();

  if (label) label.textContent = stateSuffix(state);

  if (!state) return;

  const paint = document.createElement("span");

  paint.dataset.paint = "";
  paint.ariaHidden = "true";
  paint.className = cn(NAME_PAINT_CLASS, STATE_FILLS[state]);
  paint.textContent = entry.name;
  entry.button.insertBefore(paint, label);
}

function renderWall(wall: readonly WallEntry[], previous: Marks, marks: Marks) {
  const changed = new Set(changedCodes(previous, marks));

  for (const entry of wall) {
    if (changed.has(entry.code)) paintName(entry, marks[entry.code]);
  }
}

function renderTallies(wall: readonly WallEntry[], state: LandingState) {
  const tallyOf = (continent: string | undefined) =>
    tallyMarks(
      continent === undefined ? wall : wall.filter((entry) => entry.continent === continent),
      state.marks,
    );

  const total = tallyOf(undefined);

  for (const count of elements("[data-count]")) {
    const counted = stateNamed(count.dataset.count);

    if (counted) count.textContent = String(tallyOf(count.dataset.pool)[counted]);
  }

  for (const share of elements("[data-share]")) {
    const shared = stateNamed(share.dataset.share);

    if (shared) share.style.width = `${tallyShare(total, shared)}%`;
  }

  for (const row of elements("[data-cells]")) {
    const states = cellStates(tallyOf(row.dataset.cells));

    [...row.children].forEach((cell, index) => {
      const className = cn(CELL_CLASS, CELL_FILLS[states[index] ?? "unmarked"]);

      if (cell.className !== className) cell.className = className;
    });
  }

  for (const button of elements("[data-clear]")) button.hidden = total.unmarked === wall.length;

  for (const label of elements("[data-clear-label]")) {
    label.textContent = clearLabel(state.isSample);
  }

  setText(document, "[data-announcer]", tallyAnnouncement(total, wall.length));
}

function renderIslands(marks: Marks) {
  for (const island of elements("[data-island]")) {
    const state = marks[island.dataset.pick ?? ""];
    const dot = island.querySelector<HTMLElement>("[data-dot]");

    if (dot) dot.style.backgroundColor = STATE_COLORS[state ?? "unmarked"];

    setText(island, "[data-state-label]", stateSuffix(state));
  }
}

function listRow(template: HTMLTemplateElement, country: WallCountry, state?: CountryState) {
  const row = document.importNode(template.content, true);
  const chip = row.querySelector("[data-row-state]");

  setText(row, "[data-row-flag]", country.flag);
  setText(row, "[data-row-name]", country.name);
  setText(row, "[data-row-continent]", country.continent);

  if (chip) {
    chip.className = state
      ? cn(STATE_CHIP_CLASS, STATE_FILLS[state], LIST_STATE_CLASS)
      : cn(LIST_STATE_CLASS, "text-mute");
    chip.textContent = state ? STATE_LABELS[state] : "Not marked";
  }

  return row;
}

function renderList(wall: readonly WallEntry[], marks: Marks) {
  const list = document.querySelector("[data-list]");
  const template = document.querySelector<HTMLTemplateElement>("template[data-list-row]");

  if (!list || !template) return;

  list.replaceChildren(
    ...listRows(wall, marks).map((country) => listRow(template, country, marks[country.code])),
  );
}

function lastPickChip(slot: Element, isSamePick: boolean): Element {
  if (isSamePick && slot.firstElementChild) return slot.firstElementChild;

  const chip = document.createElement("p");

  chip.ariaHidden = "true";
  slot.replaceChildren(chip);

  return chip;
}

function renderLastPick(wall: readonly WallEntry[], previous: LandingState, state: LandingState) {
  const slot = document.querySelector("[data-last-pick]");
  const focus = state.focus;

  if (!slot || !focus) return;

  const mark = state.marks[focus.code];
  const chip = lastPickChip(slot, focus === previous.focus);

  chip.className = cn(LAST_PICK_CLASS, mark ? STATE_FILLS[mark] : LAST_PICK_CLEARED_CLASS);
  chip.textContent = wall.find((entry) => entry.code === focus.code)?.name ?? "";
}

export function renderLanding(
  wall: readonly WallEntry[],
  previous: LandingState,
  state: LandingState,
) {
  renderWall(wall, previous.marks, state.marks);
  renderTallies(wall, state);
  renderIslands(state.marks);
  renderList(wall, state.marks);
  renderLastPick(wall, previous, state);
}
