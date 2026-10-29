import { SOVEREIGN_COUNTRIES } from "@/features/countries";
import type { CountryState, Marks } from "@/features/marks";

export const SAMPLE_MARKS: Marks = {
  PRT: "visited",
  ESP: "visited",
  FRA: "visited",
  ITA: "visited",
  GRC: "visited",
  GBR: "visited",
  NLD: "visited",
  MAR: "visited",
  USA: "visited",
  MEX: "visited",
  PER: "visited",
  JPN: "visited",
  ISL: "want",
  ARG: "want",
  KEN: "want",
  VNM: "want",
  NZL: "want",
};

export const SAMPLE_CENTER: [number, number] = [-4, 32];

export const WALL_COUNTRIES = SOVEREIGN_COUNTRIES.toSorted((first, second) =>
  first.name.localeCompare(second.name, "en"),
);

const PICK_ORDER: readonly (CountryState | undefined)[] = [
  undefined,
  "visited",
  "want",
  "not_interested",
];

export function nextState(state: CountryState | undefined): CountryState | undefined {
  return PICK_ORDER[(PICK_ORDER.indexOf(state) + 1) % PICK_ORDER.length];
}

export function pickMark(marks: Marks, code: string): Marks {
  const { [code]: current, ...rest } = marks;
  const next = nextState(current);

  return next ? { ...rest, [code]: next } : rest;
}
