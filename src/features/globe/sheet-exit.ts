export const EXIT_MS = 200;

export const EXIT_TIMEOUT_MS = 2 * EXIT_MS;

type Timers = {
  setTimeout: (callback: () => void, delayMs: number) => number;
  clearTimeout: (timerId: number) => void;
};

export function afterExit<T>(finished: Promise<T>, timers: Timers, onEnd: () => void) {
  let hasEnded = false;

  const timerId = timers.setTimeout(end, EXIT_TIMEOUT_MS);

  function end() {
    if (hasEnded) return;

    hasEnded = true;
    timers.clearTimeout(timerId);
    onEnd();
  }

  finished.then(end, end);
}
