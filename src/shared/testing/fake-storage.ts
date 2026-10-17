export function createFakeStorage(entries: Record<string, string> = {}) {
  const items = new Map(Object.entries(entries));

  const storage: Storage = {
    get length() {
      return items.size;
    },
    key: (index) => [...items.keys()][index] ?? null,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
    removeItem: (key) => {
      items.delete(key);
    },
    clear: () => {
      items.clear();
    },
  };

  return { storage, items: () => Object.fromEntries(items) };
}
