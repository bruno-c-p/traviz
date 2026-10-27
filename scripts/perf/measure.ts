import { execFileSync, type ChildProcess } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { cpus, loadavg, release, totalmem, type } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { z } from "zod";
import { homePath, listPath, signInPath, statsPath } from "@/paths";
import { createSignInToken, findSeededUserId } from "@/shared/testing/clerk-dev";
import {
  BrowserPage,
  blockedUrlPatterns,
  throttle,
  type Sample,
} from "@/shared/testing/perf/browser";
import {
  buildTree,
  findFreePort,
  startServer,
  stopServer,
  waitForServer,
  type Environment,
} from "@/shared/testing/perf/builds";
import { readPerfEnvironment } from "@/shared/testing/perf/environment";
import { findGuardFailures, resolveBaseline } from "@/shared/testing/perf/guards";
import { acquireLock, machineLockPath } from "@/shared/testing/perf/lock";
import {
  buildRows,
  formatRows,
  scenarioName,
  type MetricRow,
  type Scenario,
  type Side,
  type Visit,
} from "@/shared/testing/perf/report";
import { seedMarks, seededMarks, type SeedPlan } from "@/shared/testing/perf/seed";
import { byteTolerance, significanceLevel, timingFloor } from "@/shared/testing/perf/stats";
import { countries } from "@/features/countries";
import type { Marks } from "@/features/marks";

const { values: options } = parseArgs({
  args: process.argv.slice(2).filter((argument) => argument !== "--"),
  options: {
    baseline: { type: "string", default: "main" },
    "allow-lockfile-diff": { type: "boolean", default: false },
    runs: { type: "string", default: "5" },
    root: { type: "string" },
    chrome: {
      type: "string",
      default:
        process.platform === "darwin"
          ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
          : "google-chrome",
    },
  },
});

const root = resolve(options.root ?? join(import.meta.dirname, "..", ".."));
const runs = Number(options.runs);
const workDirectory = join(root, ".data", "perf");
const timeoutMs = 60_000;
const sides: Side[] = ["baseline", "candidate"];

const visitedCount = 30;

const seedPlan = [
  ["visited", visitedCount],
  ["want", 12],
  ["not_interested", 7],
] as const satisfies SeedPlan<Marks[string]>;

const visitedCounter = `/(?<!\\d)${visitedCount}\\s*(of|\\/)\\s*\\d/.test(document.body.textContent)`;
const visitedFilter = `/Visited\\s*${visitedCount}(?!\\d)/.test(document.querySelector('[aria-label="Filter by status"]')?.textContent ?? "")`;

const routes = [
  { path: homePath(), expectGlobe: true, expression: visitedCounter, hasReturnFromList: true },
  { path: listPath(), expectGlobe: false, expression: visitedFilter },
  { path: statsPath(), expectGlobe: false, expression: visitedCounter },
];

const minimumRuns = 5;

const returnVisits = ["return from /list, warm", "return from /list, cold"] as const;

const scenarios: Scenario[] = routes.flatMap((route) => [
  { ...route, visit: "first visit" as const },
  { ...route, visit: "repeat visit" as const },
  ...(route.hasReturnFromList ? returnVisits.map((visit) => ({ ...route, visit })) : []),
]);

const marks = seededMarks(
  countries.flatMap((country) => (country.kind === "sovereign" ? [country.code] : [])),
  seedPlan,
);

function fail(message: string): never {
  console.error(`Refusing: ${message}`);
  process.exit(1);
}

function revParse(ref: string): string {
  return execFileSync("git", ["-C", root, "rev-parse", `${ref}^{commit}`], {
    encoding: "utf8",
  }).trim();
}

async function signIn(page: BrowserPage, origin: string, userId: string): Promise<void> {
  await page.navigate(`${origin}${homePath()}`, timeoutMs);

  if ((await page.evaluate("location.pathname", z.string())) !== signInPath()) return;

  await page.evaluate(
    `new Promise((resolve) => {
    const check = () => (window.Clerk?.loaded ? resolve(true) : setTimeout(check, 100));
    check();
  })`,
    z.boolean(),
  );
  await page.evaluate(
    `(async () => {
    const signIn = await window.Clerk.client.signIn.create({ strategy: "ticket", ticket: ${JSON.stringify(createSignInToken(userId))} });
    await window.Clerk.setActive({ session: signIn.createdSessionId });
    return true;
  })()`,
    z.boolean(),
  );
  await page.navigate(`${origin}${homePath()}`, timeoutMs);

  if ((await page.evaluate("location.pathname", z.string())) !== homePath())
    throw new Error(`Sign-in on ${origin} did not reach ${homePath()}.`);
}

async function measureScenario(
  page: BrowserPage,
  origin: string,
  route: (typeof routes)[number],
): Promise<[Visit, Sample][]> {
  const url = `${origin}${route.path}`;

  await page.warmUp(url, timeoutMs);
  await page.navigate("about:blank", timeoutMs);
  await page.clearForFirstVisit(origin);
  await page.setThrottled(true);

  try {
    const firstVisit = await page.measure(url, route.expectGlobe, timeoutMs);
    const repeatVisit = await page.measure(url, route.expectGlobe, timeoutMs);

    const visits: [Visit, Sample][] = [
      ["first visit", firstVisit],
      ["repeat visit", repeatVisit],
    ];

    if (route.hasReturnFromList) {
      const listUrl = `${origin}${listPath()}`;

      visits.push([
        "return from /list, warm",
        await page.measureSoftNavigation(listUrl, route.path, timeoutMs),
      ]);
      await page.navigate("about:blank", timeoutMs);
      await page.clearForFirstVisit(origin);
      visits.push([
        "return from /list, cold",
        await page.measureSoftNavigation(listUrl, route.path, timeoutMs),
      ]);
    }

    return visits;
  } finally {
    await page.setThrottled(false);
  }
}

async function preflight(
  page: BrowserPage,
  origins: Record<Side, string>,
  shas: Record<Side, string>,
): Promise<void> {
  for (const side of sides)
    for (const route of routes)
      await page
        .measure(`${origins[side]}${route.path}`, route.expectGlobe, timeoutMs)
        .catch((cause: unknown) => {
          throw new Error(
            `The ${side} build (${shas[side]}) failed the unthrottled readiness check on ${route.path}, so its UI may not match the probe: ${cause instanceof Error ? cause.message : String(cause)}`,
          );
        });
}

function formatLoad(): string {
  return loadavg()
    .map((load) => load.toFixed(2))
    .join(" ");
}

function printHeader(
  shas: Record<Side, string>,
  baselineLabel: string,
  chromeVersion: string,
  webGlRenderer: string,
): void {
  const cpu = cpus();

  console.log(
    `machine: ${type()} ${release()}, ${cpu[0]?.model ?? "unknown CPU"} x${cpu.length}, ${Math.round(totalmem() / 1024 ** 3)} GB, load ${formatLoad()}`,
  );

  if (loadavg()[0] > cpu.length)
    console.log(
      `warning: the 1-minute load (${loadavg()[0].toFixed(1)}) is above ${cpu.length} cores, so other work on this machine adds noise. Alternating sides spreads it evenly, but a quieter machine gives tighter spreads.`,
    );
  console.log(`browser: ${chromeVersion}, headless, WebGL ${webGlRenderer}`);
  console.log(
    `bun ${Bun.version}, baseline ${baselineLabel} ${shas.baseline}, candidate HEAD ${shas.candidate}`,
  );
  console.log(
    `throttle: ${throttle.latencyMs} ms RTT, ${(throttle.downloadBytesPerSecond * 8) / 1e6} Mbps down, ${(throttle.uploadBytesPerSecond * 8) / 1e3} kbps up, ${throttle.cpuSlowdown}x CPU (CDP devtools throttling, not Lighthouse simulation)`,
  );
  console.log(
    `viewport: ${throttle.viewport.width}x${throttle.viewport.height} at ${throttle.viewport.deviceScaleFactor}x, mobile`,
  );
  console.log("not throttled: Web Worker requests, so Mapbox tile fetches run at full speed.");
  console.log(
    `blocked: ${blockedUrlPatterns.join(", ")} through Network.setBlockedURLs, which keeps the HTTP cache on.`,
  );
  console.log(
    `runs: ${runs} per scenario and side, alternating which side goes first. Scenarios: ${scenarios.map(scenarioName).join(", ")}. Each return from ${listPath()} loads ${listPath()}, warm or after clearing the cache and storage, then clicks the ${homePath()} tab bar link and times from the click, so it has no TTFB, FCP or LCP. Data: ${marks.length} seeded marks, ${visitedCount} visited.`,
  );
  console.log(
    `noise: spread is the median absolute deviation (MAD). A timing counts as faster or slower only when an exact two-sided Mann-Whitney test gives p < ${significanceLevel}${runs === minimumRuns ? ` (with ${minimumRuns} runs a side, no overlap)` : ""} and the median moves by at least ${timingFloor.ms} ms or ${timingFloor.share * 100}%, whichever is larger. A byte delta counts above ${byteTolerance.bytes / 1024} KB or ${byteTolerance.share * 100}%, whichever is larger. Each load ends when its network is idle for 500 ms, so repeat visits start warm.`,
  );
}

function emptySamples(): Record<Side, Sample[]> {
  return { baseline: [], candidate: [] };
}

async function prepare() {
  if (!Number.isInteger(runs) || runs < minimumRuns)
    fail(
      `--runs must be an integer of at least ${minimumRuns}, or no timing can pass the significance test.`,
    );

  const resolution = resolveBaseline(root, options.baseline);

  if (resolution.kind === "refused") fail(resolution.reason);

  const { baseline } = resolution;

  if (baseline.note !== "") console.log(baseline.note);

  const lockfilePolicy = options["allow-lockfile-diff"] ? "may-differ" : "same-as-baseline";
  const failures = findGuardFailures(root, baseline, Bun.version, lockfilePolicy);

  if (failures.length > 0) fail(failures.join("\nRefusing: "));

  if (lockfilePolicy === "may-differ")
    console.log(
      `--allow-lockfile-diff: each side installs its own bun.lock, so dependency changes since ${baseline.label} count in the result.`,
    );

  const localEnvironment = readPerfEnvironment(root, process.env);

  if (localEnvironment.kind === "refused") fail(localEnvironment.reason);

  const { environment, databaseUrl } = localEnvironment;
  const userId = findSeededUserId();

  if (!userId) fail("the dev test user does not exist. Run bun run setup first.");

  await seedMarks(databaseUrl, userId, marks);
  console.log(`Seeded ${marks.length} marks for the dev test user in the local database.`);

  const shas: Record<Side, string> = {
    baseline: baseline.sha,
    candidate: revParse("HEAD"),
  };

  return { environment, userId, shas, baselineLabel: baseline.label };
}

function treeDirectory(sha: string): string {
  return join(workDirectory, "trees", sha);
}

function buildTrees(shas: Record<Side, string>, environment: Environment): void {
  const treesDirectory = join(workDirectory, "trees");

  mkdirSync(join(workDirectory, "logs"), { recursive: true });
  mkdirSync(treesDirectory, { recursive: true });

  for (const staleTree of readdirSync(treesDirectory))
    if (!Object.values(shas).includes(staleTree))
      rmSync(join(treesDirectory, staleTree), { recursive: true, force: true });

  for (const sha of new Set(Object.values(shas))) {
    const logPath = join(workDirectory, "logs", `build-${sha}.log`);

    console.log(`Building ${sha} in ${treeDirectory(sha)}, log ${logPath}`);
    buildTree(root, sha, treeDirectory(sha), { ...environment, NODE_ENV: "production" }, logPath);
  }
}

type ResultsFile = {
  shas: Record<Side, string>;
  runs: number;
  partial: boolean;
  throttle: typeof throttle;
  rows: MetricRow[];
  samples: Record<string, Record<Side, Sample[]>>;
};

function writeResults(resultsPath: string, contents: ResultsFile): void {
  mkdirSync(join(workDirectory, "results"), { recursive: true });
  writeFileSync(resultsPath, JSON.stringify(contents, null, 2));
}

async function collectSamples(
  page: BrowserPage,
  origins: Record<Side, string>,
  shas: Record<Side, string>,
  resultsPath: string,
) {
  const samples = new Map(scenarios.map((scenario) => [scenarioName(scenario), emptySamples()]));

  for (let run = 0; run < runs; run++)
    for (const route of routes)
      for (const side of run % 2 === 0 ? sides : sides.toReversed()) {
        const visits = await measureScenario(page, origins[side], route);

        for (const [visit, sample] of visits)
          samples.get(scenarioName({ ...route, visit }))?.[side].push(sample);
        console.log(
          `run ${run + 1}/${runs} ${route.path} ${side}: marks ${visits.map(([visit, sample]) => `${Math.round(sample.marksReady)} ms ${visit}`).join(", ")}`,
        );
        writeResults(resultsPath, {
          shas,
          runs,
          partial: true,
          throttle,
          rows: [],
          samples: Object.fromEntries(samples),
        });
      }

  return samples;
}

function report(
  samples: Map<string, Record<Side, Sample[]>>,
  shas: Record<Side, string>,
  page: BrowserPage,
  resultsPath: string,
): void {
  const rows = buildRows(scenarios, samples);

  console.log("");
  console.log(formatRows(rows));
  console.log("");

  for (const side of sides) {
    const loads = [...samples.values()].flatMap((bySide) => bySide[side]);
    const redirected = loads.filter((sample) => sample.documentRedirects > 0).length;

    console.log(
      `${side}: ${redirected} of ${loads.length} measured loads took a Clerk handshake redirect.`,
    );
  }

  console.log(`blocked requests: ${page.counters.blockedRequests}. Load at end: ${formatLoad()}.`);

  writeResults(resultsPath, {
    shas,
    runs,
    partial: false,
    throttle,
    rows,
    samples: Object.fromEntries(samples),
  });
  console.log(`results: ${resultsPath}`);
}

function acquireMachineLock(): void {
  const lock = acquireLock(machineLockPath());

  if (lock.kind === "refused") fail(lock.reason);

  process.once("exit", lock.release);
}

async function main(): Promise<void> {
  acquireMachineLock();

  const { environment, userId, shas, baselineLabel } = await prepare();

  buildTrees(shas, environment);

  const servers: ChildProcess[] = [];
  const profileDirectory = join(workDirectory, "chrome-profile");
  let page: BrowserPage | undefined;
  let chrome: ChildProcess | undefined;

  const cleanUp = (): void => {
    page?.close();
    chrome?.kill();

    for (const server of servers) stopServer(server);
  };

  for (const [signal, exitCode] of [
    ["SIGINT", 130],
    ["SIGTERM", 143],
  ] as const)
    process.once(signal, () => {
      cleanUp();
      process.exit(exitCode);
    });

  const serve = async (side: Side): Promise<string> => {
    const port = await findFreePort();
    const logPath = join(workDirectory, "logs", `${side}.log`);

    const server = startServer(treeDirectory(shas[side]), port, environment, logPath);

    servers.push(server);
    await waitForServer(server, port, logPath);

    return `http://localhost:${port}`;
  };

  try {
    const origins: Record<Side, string> = {
      baseline: await serve("baseline"),
      candidate: await serve("candidate"),
    };

    rmSync(profileDirectory, { recursive: true, force: true });
    page = await BrowserPage.launch(options.chrome, profileDirectory, routes, (child) => {
      chrome = child;
    });

    for (const side of sides) await signIn(page, origins[side], userId);

    await preflight(page, origins, shas);

    printHeader(shas, baselineLabel, await page.browserVersion(), await page.webGlRenderer());
    const resultsFile = `${new Date().toISOString().replaceAll(":", "-")}.json`;
    const resultsPath = join(workDirectory, "results", resultsFile);

    console.log(`results so far: ${resultsPath}`);

    report(await collectSamples(page, origins, shas, resultsPath), shas, page, resultsPath);
  } finally {
    cleanUp();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
