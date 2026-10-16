import { afterAll, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { acquireLock, machineLockPath } from "@/shared/testing/perf/lock";

const lockDirectory = join(
  import.meta.dir,
  "..",
  "..",
  "..",
  "..",
  ".data",
  `perf-lock-test-${process.pid}`,
);

const lockPath = join(lockDirectory, "perf.lock");
const lockModule = join(import.meta.dir, "lock.ts");

afterAll(() => {
  rmSync(lockDirectory, { recursive: true, force: true });
});

function resetLock(holder?: string): void {
  rmSync(lockDirectory, { recursive: true, force: true });
  mkdirSync(lockDirectory, { recursive: true });

  if (holder === undefined) return;

  mkdirSync(lockPath);
  writeFileSync(join(lockPath, "pid"), holder);
}

async function deadPid(): Promise<number> {
  const child = spawn(process.execPath, ["-e", ""]);

  await new Promise((resolve) => child.once("exit", resolve));

  return child.pid ?? 0;
}

function contend(startAt: number): Promise<string> {
  const script = `
    const { acquireLock } = await import(${JSON.stringify(lockModule)});
    while (Date.now() < ${startAt});
    let result;
    try {
      result = acquireLock(${JSON.stringify(lockPath)});
    } catch (cause) {
      console.log("threw " + cause.message);
      process.exit(0);
    }
    console.log(result.kind);
    if (result.kind === "acquired") setTimeout(() => result.release(), 1500);
  `;

  const child = spawn(process.execPath, ["-e", script]);
  let output = "";

  child.stdout.on("data", (chunk: Buffer) => {
    output += chunk.toString();
  });

  return new Promise((resolve) => child.once("exit", () => resolve(output.trim())));
}

test("the lock lives outside every worktree", () => {
  expect(machineLockPath()).toEndWith(join(".local", "state", "traviz", "perf.lock"));
});

test("refuses while another live process holds the lock", async () => {
  const holder = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"]);

  try {
    resetLock(String(holder.pid));

    expect(acquireLock(lockPath)).toEqual({
      kind: "refused",
      reason: `another bun run perf holds ${lockPath}, and runs on one machine skew each other. Delete it only if no perf run is active.`,
    });
  } finally {
    holder.kill();
    await new Promise((resolve) => holder.once("exit", resolve));
  }
});

test("refuses a lock whose holder cannot be read", () => {
  resetLock("");

  expect(acquireLock(lockPath).kind).toBe("refused");
});

test("takes over a lock whose holder has exited, and release removes it", async () => {
  resetLock(String(await deadPid()));

  const result = acquireLock(lockPath);

  expect(result.kind).toBe("acquired");
  expect(readFileSync(join(lockPath, "pid"), "utf8")).toBe(String(process.pid));

  if (result.kind === "acquired") result.release();

  expect(existsSync(lockPath)).toBe(false);
});

test("recovers a takeover mutex left behind by a dead process", async () => {
  resetLock(String(await deadPid()));
  mkdirSync(`${lockPath}.takeover`);
  writeFileSync(join(`${lockPath}.takeover`, "pid"), String(await deadPid()));

  const result = acquireLock(lockPath);

  expect(result.kind).toBe("acquired");
  expect(existsSync(`${lockPath}.takeover`)).toBe(false);

  if (result.kind === "acquired") result.release();
});

test("recovers an old takeover mutex that never got a PID", async () => {
  resetLock(String(await deadPid()));
  mkdirSync(`${lockPath}.takeover`);
  utimesSync(`${lockPath}.takeover`, new Date(Date.now() - 60_000), new Date(Date.now() - 60_000));

  expect(acquireLock(lockPath).kind).toBe("acquired");
});

test("refuses and names the mutex while a live process holds it", async () => {
  const taker = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"]);

  try {
    resetLock(String(await deadPid()));
    mkdirSync(`${lockPath}.takeover`);
    writeFileSync(join(`${lockPath}.takeover`, "pid"), String(taker.pid));

    const result = acquireLock(lockPath);

    expect(result.kind).toBe("refused");
    expect(result.kind === "refused" ? result.reason : "").toContain(`${lockPath}.takeover`);
  } finally {
    taker.kill();
    await new Promise((resolve) => taker.once("exit", resolve));
  }
});

test("six processes racing for a stale lock leave exactly one holder", async () => {
  for (let trial = 0; trial < 3; trial++) {
    resetLock(String(await deadPid()));

    const startAt = Date.now() + 1500;
    const results = await Promise.all(Array.from({ length: 6 }, () => contend(startAt)));

    expect(results.filter((result) => result === "acquired")).toHaveLength(1);
    expect(results.filter((result) => result === "refused")).toHaveLength(5);
  }
}, 30_000);

test("eight processes recovering one orphaned mutex never throw, and one holds the lock", async () => {
  for (let trial = 0; trial < 5; trial++) {
    resetLock(String(await deadPid()));
    mkdirSync(`${lockPath}.takeover`);
    writeFileSync(join(`${lockPath}.takeover`, "pid"), String(await deadPid()));

    const startAt = Date.now() + 1500;
    const results = await Promise.all(Array.from({ length: 8 }, () => contend(startAt)));

    expect(results.filter((result) => result !== "acquired" && result !== "refused")).toEqual([]);
    expect(results.filter((result) => result === "acquired")).toHaveLength(1);
  }
}, 60_000);
