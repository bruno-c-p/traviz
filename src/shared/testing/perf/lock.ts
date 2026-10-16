import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export type LockResult =
  | { kind: "acquired"; release: () => void }
  | { kind: "refused"; reason: string };

export function machineLockPath(): string {
  return join(homedir(), ".local", "state", "traviz", "perf.lock");
}

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);

    return true;
  } catch (cause: unknown) {
    return cause instanceof Error && "code" in cause && cause.code === "EPERM";
  }
}

function readHolder(lockPath: string): number | undefined {
  try {
    const holder = Number(readFileSync(join(lockPath, "pid"), "utf8"));

    return Number.isInteger(holder) && holder > 0 ? holder : undefined;
  } catch {
    return undefined;
  }
}

function tryCreate(directory: string): boolean {
  try {
    mkdirSync(directory);

    return true;
  } catch (cause: unknown) {
    if (cause instanceof Error && "code" in cause && cause.code === "EEXIST") return false;

    throw cause;
  }
}

function claim(directory: string): boolean {
  try {
    if (!tryCreate(directory)) return false;

    writeFileSync(join(directory, "pid"), String(process.pid));

    return true;
  } catch {
    return false;
  }
}

function removeIfOwned(directory: string): void {
  try {
    if (readHolder(directory) === process.pid) rmSync(directory, { recursive: true, force: true });
  } catch {
    return;
  }
}

const orphanedMutexAgeMs = 10_000;

function isOrphaned(mutexPath: string): boolean {
  const taker = readHolder(mutexPath);

  if (taker !== undefined) return !isRunning(taker);

  try {
    return Date.now() - statSync(mutexPath).mtimeMs > orphanedMutexAgeMs;
  } catch {
    return false;
  }
}

function claimMutex(mutexPath: string): boolean {
  if (claim(mutexPath)) return true;

  if (!isOrphaned(mutexPath)) return false;

  try {
    rmSync(mutexPath, { recursive: true, force: true });
  } catch {
    return false;
  }

  return claim(mutexPath);
}

function acquired(lockPath: string): LockResult {
  return {
    kind: "acquired",
    release: () => removeIfOwned(lockPath),
  };
}

function held(lockPath: string): LockResult {
  return {
    kind: "refused",
    reason: `another bun run perf holds ${lockPath}, and runs on one machine skew each other. Delete it only if no perf run is active.`,
  };
}

function takeOverStale(lockPath: string, staleHolder: number): LockResult {
  const takeoverPath = `${lockPath}.takeover`;

  if (!claimMutex(takeoverPath))
    return {
      kind: "refused",
      reason: `another bun run perf is taking over the stale ${lockPath} through ${takeoverPath}. Retry in a few seconds. Delete ${takeoverPath} only if no perf run is active.`,
    };

  try {
    if (readHolder(takeoverPath) !== process.pid || readHolder(lockPath) !== staleHolder)
      return held(lockPath);

    rmSync(lockPath, { recursive: true, force: true });

    return claim(lockPath) ? acquired(lockPath) : held(lockPath);
  } catch {
    return held(lockPath);
  } finally {
    removeIfOwned(takeoverPath);
  }
}

export function acquireLock(lockPath: string): LockResult {
  mkdirSync(dirname(lockPath), { recursive: true });

  if (claim(lockPath)) return acquired(lockPath);

  const holder = readHolder(lockPath);

  if (holder === undefined || isRunning(holder)) return held(lockPath);

  return takeOverStale(lockPath, holder);
}
