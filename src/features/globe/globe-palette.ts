import type { StateColorKey } from "@/features/marks";
import type { Theme } from "@/features/theme";

export type GlobePalette = {
  space: string;
  water: string;
  border: string;
  selected: string;
  label: string;
  labelHalo: string;
  halo: string;
  haze: string;
  clear: string;
  markerRing: string;
  states: Record<StateColorKey, string>;
};

export const GLOBE_PALETTES: Record<Theme, GlobePalette> = {
  light: {
    space: "#f4f6f1",
    water: "#d3d9cd",
    border: "rgba(255, 255, 255, 0.9)",
    selected: "#0e0f0c",
    label: "#5e615c",
    labelHalo: "#ffffff",
    halo: "rgba(255, 255, 255, 0.85)",
    haze: "rgba(255, 255, 255, 0.35)",
    clear: "rgba(255, 255, 255, 0)",
    markerRing: "#ffffff",
    states: {
      visited: "#9fe870",
      want: "#7a5af8",
      not_interested: "#b9bdb5",
      unmarked: "#e8ebe6",
    },
  },
  dark: {
    space: "#0f110d",
    water: "#1d221a",
    border: "rgba(15, 17, 13, 0.9)",
    selected: "#f2f5ee",
    label: "#c3c8be",
    labelHalo: "#0f110d",
    halo: "rgba(159, 232, 112, 0.14)",
    haze: "rgba(15, 17, 13, 0.4)",
    clear: "rgba(15, 17, 13, 0)",
    markerRing: "#0f110d",
    states: {
      visited: "#9fe870",
      want: "#7a5af8",
      not_interested: "#646b5f",
      unmarked: "#353b31",
    },
  },
};
