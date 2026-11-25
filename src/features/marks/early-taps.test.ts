import { expect, test } from "bun:test";
import {
  EARLY_TAPS_SCRIPT,
  captureEarlyTaps,
  replayEarlyTaps,
  takeEarlyTaps,
} from "@/features/marks/early-taps";
import type { EarlyTapRegistry } from "@/features/marks/early-taps";

type FakeButton = ReturnType<typeof fakeButton>;

function fakeButton(state: string, isPressed: boolean) {
  const attributes = new Map([["aria-pressed", String(isPressed)]]);

  const button = {
    dataset: { state },
    parentElement: null,
    children: [],
    getAttribute: (name: string) => attributes.get(name) ?? null,
    setAttribute: (name: string, value: string) => {
      attributes.set(name, value);
    },
    closest: (selector: string) => (selector === "button[data-state]" ? button : null),
  };

  return button;
}

function fakeRow(code: string, pressed: string | null) {
  const buttons: FakeButton[] = ["visited", "want", "not_interested"].map((state) =>
    fakeButton(state, state === pressed),
  );

  const group = {
    dataset: { code },
    parentElement: null,
    children: buttons,
    getAttribute: () => null,
    setAttribute: () => {},
  };

  const grouped = buttons.map((button) => ({ ...button, parentElement: group }));

  return {
    tap: (state: string) => ({
      target: {
        closest: (selector: string) =>
          selector === "button[data-state]"
            ? (grouped.find((button) => button.dataset.state === state) ?? null)
            : null,
      },
    }),
    pressed: () =>
      buttons.flatMap((button) =>
        button.getAttribute("aria-pressed") === "true" ? [button.dataset.state] : [],
      ),
  };
}

function fakeRoot() {
  type Listener = Parameters<Parameters<typeof captureEarlyTaps>[0]["addEventListener"]>[1];

  const listeners = new Set<Listener>();

  return {
    root: {
      addEventListener: (_type: "click", listener: Listener) => {
        listeners.add(listener);
      },
      removeEventListener: (_type: "click", listener: Listener) => {
        listeners.delete(listener);
      },
    },
    click: (event: Parameters<Listener>[0]) => listeners.forEach((listener) => listener(event)),
    listenerCount: () => listeners.size,
  };
}

test("a tap before the app starts presses its button, releases the others and is recorded", () => {
  const { root, click } = fakeRoot();
  const registry: EarlyTapRegistry = {};
  const zambia = fakeRow("ZMB", "visited");

  captureEarlyTaps(root, registry);
  click(zambia.tap("want"));

  expect(zambia.pressed()).toEqual(["want"]);
  expect(registry.travizEarlyTaps?.taps).toEqual([{ code: "ZMB", state: "want" }]);
});

test("a tap on the pressed button releases it and is recorded as a clear", () => {
  const { root, click } = fakeRoot();
  const registry: EarlyTapRegistry = {};
  const zambia = fakeRow("ZMB", "want");

  captureEarlyTaps(root, registry);
  click(zambia.tap("want"));

  expect(zambia.pressed()).toEqual([]);
  expect(registry.travizEarlyTaps?.taps).toEqual([{ code: "ZMB", state: "" }]);
});

test("a click anywhere else records nothing", () => {
  const { root, click } = fakeRoot();
  const registry: EarlyTapRegistry = {};

  captureEarlyTaps(root, registry);
  click({ target: { closest: () => null } });
  click({ target: null });

  expect(registry.travizEarlyTaps?.taps).toEqual([]);
});

test("taking the taps stops the capture and empties the registry", () => {
  const { root, click, listenerCount } = fakeRoot();
  const registry: EarlyTapRegistry = {};

  captureEarlyTaps(root, registry);
  click(fakeRow("ZMB", null).tap("visited"));

  expect(takeEarlyTaps(registry)).toEqual([{ code: "ZMB", state: "visited" }]);
  expect(listenerCount()).toBe(0);
  expect(registry.travizEarlyTaps).toBeUndefined();
  expect(takeEarlyTaps(registry)).toEqual([]);
});

test("the taps replay into the store in order, a clear for the empty state", () => {
  const calls: string[] = [];

  replayEarlyTaps(
    {
      mark: (code, state) => calls.push(`mark ${code} ${state}`),
      clear: (code) => calls.push(`clear ${code}`),
    },
    [
      { code: "ZMB", state: "want" },
      { code: "ZMB", state: "" },
      { code: "FRA", state: "not_interested" },
    ],
  );

  expect(calls).toEqual(["mark ZMB want", "clear ZMB", "mark FRA not_interested"]);
});

test("the inline script is the capture function called with the document and the window", () => {
  expect(EARLY_TAPS_SCRIPT.startsWith("(")).toBe(true);
  expect(EARLY_TAPS_SCRIPT.endsWith(")(document,window)")).toBe(true);
  expect(EARLY_TAPS_SCRIPT).toContain("travizEarlyTaps");
  expect(EARLY_TAPS_SCRIPT).not.toContain("import");
});
