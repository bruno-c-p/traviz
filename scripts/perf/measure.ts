import { execFileSync, type ChildProcess } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { cpus, loadavg, release, totalmem, type } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { z } from "zod";
import { homePath, listPath, signInPath, statsPath, welcomePath } from "@/paths";
import { ticketSignInExpression } from "@/shared/testing/clerk-browser";
import { createSignInToken, findSeededUserId } from "@/shared/testing/clerk-dev";
import {
  BrowserPage,
  blockedUrlPatterns,
  throttle,
  type Sample,
} from "@/shared/testing/perf/browser";
import {
  buildTree,
  commitKind,
  findFreePort,
  startServer,
  stopServer,
  waitForServer,
  type Environment,
  type TreeKind,
} from "@/shared/testing/perf/builds";
import {
  FIXED_USER_ID,
  readPerfEnvironment,
  withSignInMode,
  type SignInMode,
} from "@/shared/testing/perf/environment";
import {
  findGuardFailures,
  resolveBaseline,
  type LockfilePolicy,
} from "@/shared/testing/perf/guards";
import { acquireLock, machineLockPath } from "@/shared/testing/perf/lock";
import {
  buildRows,
  formatRows,
  scenarioName,
  type MetricRow,
  type Scenario,
  type Session,
  type Side,
  type Visit,
} from "@/shared/testing/perf/report";
import { selectRoutes } from "@/shared/testing/perf/routes";
import { seedMarks, seededMarks, type SeedPlan } from "@/shared/testing/perf/seed";
import { byteTolerance, significanceLevel, timingFloor } from "@/shared/testing/perf/stats";
import { countries } from "@/features/countries";
import type { Marks } from "@/features/marks";

const { values: options } = parseArgs({
  args: process.argv.slice(2).filter((argument) => argument !== "--"),
  options: {
    baseline: { type: "string", default: "main" },
    "allow-lockfile-diff": { type: "boolean", default: false },
    "fixed-user": { type: "boolean", default: false },
    route: { type: "string", multiple: true },
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

const lockfilePolicy: LockfilePolicy = options["allow-lockfile-diff"]
  ? "may-differ"
  : "same-as-baseline";

const LOCKFILE_NOTES: Record<LockfilePolicy, (baselineLabel: string) => string> = {
  "same-as-baseline": (baselineLabel) => `bun.lock matches ${baselineLabel}.`,
  "may-differ": (baselineLabel) =>
    `--allow-lockfile-diff: each side installs its own bun.lock, so dependency changes since ${baselineLabel} count in the result.`,
};

const workDirectory = join(root, ".data", "perf");
const timeoutMs = 60_000;
const sides: Side[] = ["baseline", "candidate"];

const visitedCount = 30;

const seedPlan = [
  ["visited", visitedCount],
  ["want", 12],
  ["not_interested", 7],
] as const satisfies SeedPlan<Marks[string]>;

const visitedCounter = `/(?<!\\d)${visitedCount}\\s*(of|\\/)\\s*\\d/.test(document.body.innerText)`;
const visitedFilter = `/Visited\\s*${visitedCount}(?!\\d)/.test(document.querySelector('[aria-label="Filter by status"]')?.innerText ?? "")`;

const landingOnScreen = `document.querySelector('a[href="${signInPath()}"]') !== null && document.body.innerText.trim() !== ""`;

type MeasuredRoute = {
  readonly path: string;
  readonly session: Session;
  readonly expectGlobe: boolean;
  readonly expression: string;
  readonly hasReturnFromList: boolean;
};

const signedInRoute = { session: "signed in", hasReturnFromList: false } as const;

const allRoutes: MeasuredRoute[] = [
  {
    ...signedInRoute,
    path: homePath(),
    expectGlobe: true,
    expression: visitedCounter,
    hasReturnFromList: true,
  },
  { ...signedInRoute, path: listPath(), expectGlobe: false, expression: visitedFilter },
  { ...signedInRoute, path: statsPath(), expectGlobe: false, expression: visitedCounter },
  {
    path: welcomePath(),
    session: "signed out",
    expectGlobe: false,
    expression: landingOnScreen,
    hasReturnFromList: false,
  },
];

const { measured: routes, readyProbes } = selectRoutes(allRoutes, options.route);

const signInMode: SignInMode = options["fixed-user"] ? "fixed-user" : "clerk";
const sessions: Session[] = ["signed in", "signed out"];

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

function landedPath(page: BrowserPage): Promise<string> {
  return page.evaluate("location.pathname", z.string());
}

async function signIn(
  page: BrowserPage,
  origin: string,
  userId: string,
  publishableKey: string,
): Promise<void> {
  await page.navigate(`${origin}${listPath()}`, timeoutMs);

  if ((await landedPath(page)) === listPath()) return;

  const ticket = await Promise.resolve(createSignInToken(userId));

  await page.navigate(`${origin}${signInPath()}`, timeoutMs);
  await page
    .evaluate(ticketSignInExpression(ticket, publishableKey), z.boolean())
    .catch((cause: unknown) => {
      console.log(
        `The sign-in script on ${origin} ended early (${cause instanceof Error ? cause.message : String(cause)}). Checking the session by loading ${listPath()}.`,
      );
    });
  await page.navigate(`${origin}${listPath()}`, timeoutMs);

  if ((await landedPath(page)) !== listPath())
    throw new Error(`Sign-in on ${origin} did not reach ${listPath()}.`);
}

async function measureScenario(
  page: BrowserPage,
  origin: string,
  route: MeasuredRoute,
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
  pages: Record<Session, BrowserPage>,
  origins: Record<Side, string>,
  shas: Record<Side, string>,
): Promise<void> {
  for (const side of sides)
    for (const route of routes)
      await pages[route.session]
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

const SIGN_IN_NOTES: Record<SignInMode, string> = {
  clerk:
    "sign-in: a Clerk sign-in token for the dev test user, so both sides load clerk-js and verify a real session.",
  "fixed-user": `sign-in: --fixed-user. Both servers sign every request in as ${FIXED_USER_ID} and the builds leave clerk-js out, so the numbers exclude Clerk's cost.`,
};

async function printHeader(
  shas: Record<Side, string>,
  kinds: Record<Side, TreeKind>,
  baselineLabel: string,
  page: BrowserPage,
): Promise<void> {
  const cpu = cpus();
  const chromeVersion = await page.browserVersion();
  const webGlRenderer = await page.webGlRenderer();

  console.log(
    `machine: ${type()} ${release()}, ${cpu[0]?.model ?? "unknown CPU"} x${cpu.length}, ${Math.round(totalmem() / 1024 ** 3)} GB, load ${formatLoad()}`,
  );

  if (loadavg()[0] > cpu.length)
    console.log(
      `warning: the 1-minute load (${loadavg()[0].toFixed(1)}) is above ${cpu.length} cores, so other work on this machine adds noise. Alternating sides spreads it evenly, but a quieter machine gives tighter spreads.`,
    );
  console.log(`browser: ${chromeVersion}, headless, WebGL ${webGlRenderer}`);
  console.log(
    `bun ${Bun.version}, baseline ${baselineLabel} ${shas.baseline} (${kinds.baseline}), candidate HEAD ${shas.candidate} (${kinds.candidate})`,
  );
  console.log(
    "servers: an astro side is built with TRAVIZ_ADAPTER=node and served by this checkout's scripts/serve-node.ts, which gzips the static files as a CDN would, a next side by next build and next start.",
  );
  console.log(SIGN_IN_NOTES[signInMode]);
  console.log(
    `throttle: ${throttle.latencyMs} ms RTT, ${(throttle.downloadBytesPerSecond * 8) / 1e6} Mbps down, ${(throttle.uploadBytesPerSecond * 8) / 1e3} kbps up, ${throttle.cpuSlowdown}x CPU (CDP devtools throttling, not Lighthouse simulation)`,
  );
  console.log(
    `viewport: ${throttle.viewport.width}x${throttle.viewport.height} at ${throttle.viewport.deviceScaleFactor}x, mobile`,
  );
  console.log("not throttled: Web Worker requests.");
  console.log(
    `blocked: ${blockedUrlPatterns.join(", ")} through Network.setBlockedURLs, which keeps the HTTP cache on.`,
  );
  console.log(
    `runs: ${runs} per scenario and side, alternating which side goes first. Scenarios: ${scenarios.map(scenarioName).join(", ")}. Each return from ${listPath()} loads ${listPath()}, warm or after clearing the cache and storage, then clicks the ${homePath()} tab bar link and times from the click, so it has no TTFB, FCP or LCP. A signed-out scenario runs in a second browser that never signs in. Data: ${marks.length} seeded marks, ${visitedCount} visited.`,
  );
  console.log(
    `noise: spread is the median absolute deviation (MAD). A timing counts as faster or slower only when an exact two-sided Mann-Whitney test gives p < ${significanceLevel}${runs === minimumRuns ? ` (with ${minimumRuns} runs a side, no overlap)` : ""} and the median moves by at least ${timingFloor.ms} ms or ${timingFloor.share * 100}%, whichever is larger. A byte delta counts above ${byteTolerance.bytes / 1024} KB or ${byteTolerance.share * 100}%, whichever is larger. Each load ends when its network is idle for 500 ms, so repeat visits start warm.`,
  );
}

function emptySamples(): Record<Side, Sample[]> {
  return { baseline: [], candidate: [] };
}

function checkArguments(): void {
  if (!Number.isInteger(runs) || runs < minimumRuns)
    fail(
      `--runs must be an integer of at least ${minimumRuns}, or no timing can pass the significance test.`,
    );

  if (routes.length === 0)
    fail(
      `--route matched nothing. The routes are ${allRoutes.map(({ path }) => path).join(", ")}.`,
    );
}

function resolveSides() {
  const resolution = resolveBaseline(root, options.baseline);

  if (resolution.kind === "refused") fail(resolution.reason);

  const { baseline } = resolution;

  if (baseline.note !== "") console.log(baseline.note);

  const failures = findGuardFailures(root, baseline, Bun.version, lockfilePolicy);

  if (failures.length > 0) fail(failures.join("\nRefusing: "));

  console.log(LOCKFILE_NOTES[lockfilePolicy](baseline.label));

  const shas: Record<Side, string> = { baseline: baseline.sha, candidate: revParse("HEAD") };

  const kinds: Record<Side, TreeKind> = {
    baseline: commitKind(root, shas.baseline),
    candidate: commitKind(root, shas.candidate),
  };

  return { shas, kinds, baselineLabel: baseline.label };
}

function checkSignInMode(hasClerkKeys: boolean, kinds: Record<Side, TreeKind>): void {
  if (signInMode === "clerk" && !hasClerkKeys)
    fail(
      ".env.local has no Clerk development keys, so no real session can be measured. Run bun run setup, or pass --fixed-user to compare two Astro commits without Clerk.",
    );

  if (signInMode === "fixed-user" && sides.some((side) => kinds[side] === "next"))
    fail(
      "--fixed-user needs TRAVIZ_FIXED_USER_ID, which a Next commit does not read. Measure a Next baseline with Clerk development keys.",
    );
}

async function measuredUserId(): Promise<string> {
  if (signInMode === "fixed-user") return FIXED_USER_ID;

  return (
    (await Promise.resolve(findSeededUserId())) ??
    fail("the dev test user does not exist. Run bun run setup first.")
  );
}

async function prepare() {
  checkArguments();

  const { shas, kinds, baselineLabel } = resolveSides();
  const localEnvironment = readPerfEnvironment(root, process.env);

  if (localEnvironment.kind === "refused") fail(localEnvironment.reason);

  checkSignInMode(localEnvironment.hasClerkKeys, kinds);

  const environment = withSignInMode(localEnvironment.environment, signInMode);
  const userId = await measuredUserId();

  await seedMarks(localEnvironment.databaseUrl, userId, marks);
  console.log(`Seeded ${marks.length} marks for ${userId} in the local database.`);

  return { environment, userId, shas, kinds, baselineLabel };
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
  pages: Record<Session, BrowserPage>,
  origins: Record<Side, string>,
  shas: Record<Side, string>,
  resultsPath: string,
) {
  const samples = new Map(scenarios.map((scenario) => [scenarioName(scenario), emptySamples()]));

  for (let run = 0; run < runs; run++)
    for (const route of routes)
      for (const side of run % 2 === 0 ? sides : sides.toReversed()) {
        const visits = await measureScenario(pages[route.session], origins[side], route);

        for (const [visit, sample] of visits)
          samples.get(scenarioName({ ...route, visit }))?.[side].push(sample);
        console.log(
          `run ${run + 1}/${runs} ${route.path} ${side}: ready ${visits.map(([visit, sample]) => `${Math.round(sample.marksReady)} ms ${visit}`).join(", ")}`,
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
  pages: Record<Session, BrowserPage>,
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
      `${side}: ${redirected} of ${loads.length} measured loads took a redirect, such as a Clerk handshake.`,
    );
  }

  const blockedRequests = sessions.reduce(
    (total, session) => total + pages[session].counters.blockedRequests,
    0,
  );

  console.log(`blocked requests: ${blockedRequests}. Load at end: ${formatLoad()}.`);

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

  const { environment, userId, shas, kinds, baselineLabel } = await prepare();

  buildTrees(shas, environment);

  const servers: ChildProcess[] = [];
  const browsers: BrowserPage[] = [];
  const chromes: ChildProcess[] = [];

  const cleanUp = (): void => {
    for (const browser of browsers) browser.close();

    for (const chrome of chromes) chrome.kill();

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

  const launch = async (session: Session): Promise<BrowserPage> => {
    const profileDirectory = join(workDirectory, `chrome-profile-${session.replace(" ", "-")}`);

    rmSync(profileDirectory, { recursive: true, force: true });

    const browser = await BrowserPage.launch(
      options.chrome,
      profileDirectory,
      readyProbes,
      (child) => {
        chromes.push(child);
      },
    );

    browsers.push(browser);

    return browser;
  };

  try {
    const origins: Record<Side, string> = {
      baseline: await serve("baseline"),
      candidate: await serve("candidate"),
    };

    const signedInPage = await launch("signed in");

    const pages: Record<Session, BrowserPage> = {
      "signed in": signedInPage,
      "signed out": await launch("signed out"),
    };

    if (signInMode === "clerk")
      for (const side of sides)
        await signIn(
          signedInPage,
          origins[side],
          userId,
          environment.PUBLIC_CLERK_PUBLISHABLE_KEY ?? "",
        );

    await preflight(pages, origins, shas);

    await printHeader(shas, kinds, baselineLabel, signedInPage);

    const resultsFile = `${new Date().toISOString().replaceAll(":", "-")}.json`;
    const resultsPath = join(workDirectory, "results", resultsFile);

    console.log(`results so far: ${resultsPath}`);

    report(await collectSamples(pages, origins, shas, resultsPath), shas, pages, resultsPath);
  } finally {
    cleanUp();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
