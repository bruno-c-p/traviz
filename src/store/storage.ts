export function load(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    /* localStorage unavailable: private browsing, disabled, or blocked */
    return null;
  }
}

export function save(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    /* localStorage unavailable or quota exceeded: drop the write silently */
  }
}

export function remove(key: string): void {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    /* localStorage unavailable */
  }
}
