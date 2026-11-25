import { expect, test } from "bun:test";
import { createStore } from "@/shared/store";

type Counter = { count: number; label: string; increment: () => void };

function createCounter() {
  return createStore<Counter>((setState) => ({
    count: 0,
    label: "taps",
    increment: () => setState((state) => ({ count: state.count + 1 })),
  }));
}

test("the setup's result is the first state", () => {
  const state = createCounter().getState();

  expect(state.count).toBe(0);
  expect(state.label).toBe("taps");
});

test("a partial update keeps the other keys and tells listeners the previous state", () => {
  const store = createCounter();
  const seen: [number, number][] = [];

  store.subscribe((state, previousState) => seen.push([state.count, previousState.count]));
  store.setState({ count: 4 });
  store.getState().increment();

  expect(store.getState()).toMatchObject({ count: 5, label: "taps" });
  expect(seen).toEqual([
    [4, 0],
    [5, 4],
  ]);
});

test("an update that changes nothing keeps the state object and tells no one", () => {
  const store = createCounter();
  const before = store.getState();
  let calls = 0;

  store.subscribe(() => {
    calls += 1;
  });
  store.setState({ count: 0 });
  store.setState(() => ({}));

  expect(store.getState()).toBe(before);
  expect(calls).toBe(0);
});

test("an unsubscribed listener hears nothing more, even when it leaves during a notification", () => {
  const store = createCounter();
  const heard: string[] = [];

  const leave = store.subscribe(() => {
    heard.push("first");
    leave();
  });

  store.subscribe(() => heard.push("second"));
  store.getState().increment();
  store.getState().increment();

  expect(heard).toEqual(["first", "second", "second"]);
});

test("the setup can read the state through its getter", () => {
  const store = createStore<{ value: number; double: () => number }>((_setState, getState) => ({
    value: 21,
    double: () => getState().value * 2,
  }));

  expect(store.getState().double()).toBe(42);
});
