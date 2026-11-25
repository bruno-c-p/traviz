export type StoreListener<T> = (state: T, previousState: T) => void;

export type StoreUpdate<T> = Partial<T> | ((state: T) => Partial<T>);

export type Store<T> = {
  readonly getState: () => T;
  readonly setState: (update: StoreUpdate<T>) => void;
  readonly subscribe: (listener: StoreListener<T>) => () => void;
};

export type StoreSetup<T> = (setState: Store<T>["setState"], getState: () => T) => T;

function isUnchanged<T extends object>(state: T, changes: Partial<T>): boolean {
  return Object.entries(changes).every(([key, value]) =>
    Object.is(Object.getOwnPropertyDescriptor(state, key)?.value, value),
  );
}

export function createStore<T extends object>(setup: StoreSetup<T>): Store<T> {
  const listeners = new Set<StoreListener<T>>();

  const setState = (update: StoreUpdate<T>) => {
    const previousState = state;
    const changes = update instanceof Function ? update(previousState) : update;

    if (isUnchanged(previousState, changes)) return;

    state = { ...previousState, ...changes };

    for (const listener of listeners) listener(state, previousState);
  };

  const getState = () => state;
  let state = setup(setState, getState);

  return {
    getState,
    setState,
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
}
