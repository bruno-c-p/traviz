import type { CountryState } from "@/features/marks/colors";
import { COUNTRY_STATES } from "@/features/marks/colors";

export type EarlyTap = { readonly code: string; readonly state: string };

export type EarlyTaps = { readonly taps: EarlyTap[]; readonly stop: () => void };

export type EarlyTapRegistry = { travizEarlyTaps?: EarlyTaps };

type TapElement = {
  readonly dataset: { readonly [name: string]: string | undefined };
  readonly parentElement: TapElement | null;
  readonly children: Iterable<TapElement>;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
};

type TapEvent = { readonly target: { closest(selector: string): TapElement | null } | null };

type TapRoot = {
  addEventListener(type: "click", listener: (event: TapEvent) => void): void;
  removeEventListener(type: "click", listener: (event: TapEvent) => void): void;
};

export function captureEarlyTaps(root: TapRoot, registry: EarlyTapRegistry): void {
  const taps: EarlyTap[] = [];

  const onClick = (event: TapEvent) => {
    const button = event.target?.closest("button[data-state]") ?? null;
    const group = button?.parentElement ?? null;
    const code = group?.dataset.code;
    const state = button?.dataset.state;

    if (button === null || group === null || code === undefined || state === undefined) return;

    const wasPressed = button.getAttribute("aria-pressed") === "true";

    for (const sibling of group.children) sibling.setAttribute("aria-pressed", "false");

    if (!wasPressed) button.setAttribute("aria-pressed", "true");

    taps.push({ code, state: wasPressed ? "" : state });
  };

  root.addEventListener("click", onClick);
  registry.travizEarlyTaps = { taps, stop: () => root.removeEventListener("click", onClick) };
}

export const EARLY_TAPS_SCRIPT = `(${captureEarlyTaps.toString()})(document,window)`;

export function takeEarlyTaps(registry: EarlyTapRegistry): readonly EarlyTap[] {
  const captured = registry.travizEarlyTaps;

  captured?.stop();
  delete registry.travizEarlyTaps;

  return captured?.taps ?? [];
}

type TapActions = {
  readonly mark: (code: string, state: CountryState) => void;
  readonly clear: (code: string) => void;
};

export function replayEarlyTaps(actions: TapActions, taps: readonly EarlyTap[]): void {
  for (const tap of taps) {
    const state = COUNTRY_STATES.find((countryState) => countryState === tap.state);

    if (state === undefined) actions.clear(tap.code);
    else actions.mark(tap.code, state);
  }
}

declare global {
  interface Window extends EarlyTapRegistry {}
}
