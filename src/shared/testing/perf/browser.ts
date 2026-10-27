import { spawn, type ChildProcess } from "node:child_process";
import { z } from "zod";
import { CdpConnection, noResult, type CdpParams } from "@/shared/testing/perf/cdp";

export const throttle = {
  latencyMs: 150,
  downloadBytesPerSecond: 200_000,
  uploadBytesPerSecond: 93_750,
  cpuSlowdown: 4,
  viewport: { width: 390, height: 844, deviceScaleFactor: 2 },
} as const;

const networkIdleMs = 500;

export const blockedUrlPatterns = ["*cdn.protect.clerk.com*"];

const sampleSchema = z.object({
  ttfb: z.number(),
  fcp: z.number().optional(),
  lcp: z.number().optional(),
  marksReady: z.number(),
  globeFrame: z.number().optional(),
});

const softNavigationSchema = z.object({
  marksReady: z.number(),
  globeFrame: z.number(),
});

export type Sample = Omit<z.infer<typeof sampleSchema>, "ttfb"> & {
  ttfb?: number;
  scriptBytes: number;
  documentRedirects: number;
};

export type PageLoadCounters = { blockedRequests: number; documentRedirects: number };

const targetSchema = z.object({ targetId: z.string() });
const sessionSchema = z.object({ sessionId: z.string() });

const evaluationSchema = z.object({
  result: z.object({ value: z.unknown().optional() }),
  exceptionDetails: z.object({ text: z.string() }).optional(),
});

const versionSchema = z.object({ product: z.string() });

const navigationSchema = z.object({ errorText: z.string().optional() });

const responseSchema = z.object({ requestId: z.string(), type: z.string() });
const finishedSchema = z.object({ requestId: z.string(), encodedDataLength: z.number() });
const failedSchema = z.object({ requestId: z.string(), blockedReason: z.string().optional() });

const requestSchema = z.object({
  requestId: z.string(),
  loaderId: z.string(),
  frameId: z.string().optional(),
  request: z.object({ url: z.string() }),
  type: z.string().optional(),
  redirectResponse: z.unknown().optional(),
});

export type ReadyProbe = { path: string; expression: string };

function probeSource(readyProbes: ReadyProbe[]): string {
  const probeEntries = readyProbes
    .map((probe) => `${JSON.stringify(probe.path)}: () => (${probe.expression})`)
    .join(",\n      ");

  return `(() => {
    const marks = {};
    Object.defineProperty(window, "__perfMarks", { value: marks });
    const drawWatchers = new Set();
    const drawMethods = [
      [WebGLRenderingContext, ["drawArrays", "drawElements"]],
      [WebGL2RenderingContext, ["drawArrays", "drawElements"]],
      [CanvasRenderingContext2D, ["fill", "stroke"]],
    ].flatMap(([context, names]) =>
      names.map((name) => ({ prototype: context.prototype, name, original: context.prototype[name] })),
    );
    const onDraw = (canvas) => {
      if (!canvas.isConnected) return;
      const now = performance.now();
      for (const watcher of drawWatchers) if (watcher(now)) drawWatchers.delete(watcher);
      if (drawWatchers.size > 0) return;
      for (const { prototype, name, original } of drawMethods) prototype[name] = original;
    };
    const watchDraws = (watcher) => {
      if (drawWatchers.size === 0)
        for (const { prototype, name, original } of drawMethods)
          prototype[name] = function (...args) { onDraw(this.canvas); return original.apply(this, args); };
      drawWatchers.add(watcher);
    };
    watchDraws((now) => {
      marks.globeFrame ??= now;
      return true;
    });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) marks.lcp = entry.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    const probes = {
      ${probeEntries}
    };
    const timer = setInterval(() => {
      if (!document.body || !probes[location.pathname]?.()) return;
      marks.marksReady = performance.now();
      clearInterval(timer);
    }, 50);
    Object.defineProperty(window, "__perfSoftNavigate", {
      value: (selector, path, timeoutMs) => new Promise((resolve) => {
        const link = document.querySelector(selector);
        const start = performance.now();
        const timings = {};
        watchDraws((now) => {
          if (location.pathname !== path) return false;
          timings.globeFrame = now - start;
          return true;
        });
        const check = setInterval(() => {
          if (timings.marksReady === undefined && location.pathname === path && probes[path]?.())
            timings.marksReady = performance.now() - start;
          const done = timings.marksReady !== undefined && timings.globeFrame !== undefined;
          if (!done && performance.now() - start < timeoutMs) return;
          clearInterval(check);
          resolve(done ? timings : null);
        }, 50);
        link.click();
      }),
    });
  })()`;
}

function readySource(expectGlobe: boolean, timeoutMs: number): string {
  return `new Promise((resolve) => {
    const deadline = performance.now() + ${timeoutMs};
    const check = () => {
      const marks = window.__perfMarks;
      const ready = marks.marksReady !== undefined && document.readyState === "complete" &&
        (${expectGlobe} === false || marks.globeFrame !== undefined);
      if (ready || performance.now() > deadline) resolve(ready);
      else setTimeout(check, 100);
    };
    check();
  })`;
}

const readSampleSource = `(() => {
  const navigation = performance.getEntriesByType("navigation")[0];
  const paint = performance.getEntriesByName("first-contentful-paint")[0];
  const marks = window.__perfMarks;
  return { ttfb: navigation.responseStart, fcp: paint?.startTime, lcp: marks.lcp, marksReady: marks.marksReady, globeFrame: marks.globeFrame };
})()`;

const webGlRendererSource = `(() => {
  const context = document.createElement("canvas").getContext("webgl2");
  const info = context?.getExtension("WEBGL_debug_renderer_info");
  return info ? context.getParameter(info.UNMASKED_RENDERER_WEBGL) : "no WebGL";
})()`;

export class BrowserPage {
  private scriptBytes = 0;
  private readonly scriptRequests = new Set<string>();
  private readonly pendingRequests = new Map<string, string>();
  private currentLoaderId = "";
  readonly counters: PageLoadCounters = { blockedRequests: 0, documentRedirects: 0 };
  private readonly connection: CdpConnection;
  private readonly sessionId: string;
  private readonly chrome: ChildProcess;
  private readonly mainFrameId: string;

  private constructor(
    connection: CdpConnection,
    sessionId: string,
    chrome: ChildProcess,
    mainFrameId: string,
  ) {
    this.connection = connection;
    this.mainFrameId = mainFrameId;
    this.sessionId = sessionId;
    this.chrome = chrome;

    connection.on("Network.responseReceived", sessionId, responseSchema, (response) => {
      if (response.type === "Script") this.scriptRequests.add(response.requestId);
    });
    connection.on("Network.loadingFinished", sessionId, finishedSchema, (finished) => {
      this.pendingRequests.delete(finished.requestId);

      if (this.scriptRequests.has(finished.requestId))
        this.scriptBytes += finished.encodedDataLength;
    });
    connection.on("Network.loadingFailed", sessionId, failedSchema, (failed) => {
      this.pendingRequests.delete(failed.requestId);

      if (failed.blockedReason !== undefined) this.counters.blockedRequests++;
    });
    connection.on("Network.requestWillBeSent", sessionId, requestSchema, (request) => {
      if (request.type === "Document" && request.frameId === this.mainFrameId) {
        this.currentLoaderId = request.loaderId;
        this.pendingRequests.clear();
      }

      if (request.loaderId === this.currentLoaderId && /^https?:/.test(request.request.url))
        this.pendingRequests.set(request.requestId, request.request.url);

      if (request.type === "Document" && request.redirectResponse !== undefined)
        this.counters.documentRedirects++;
    });
  }

  static async launch(
    chromePath: string,
    profileDirectory: string,
    readyProbes: ReadyProbe[],
    onSpawn: (chrome: ChildProcess) => void,
  ): Promise<BrowserPage> {
    const chrome = spawn(
      chromePath,
      [
        "--headless=new",
        "--remote-debugging-port=0",
        `--user-data-dir=${profileDirectory}`,
        "--no-first-run",
        "--no-default-browser-check",
        "about:blank",
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );

    onSpawn(chrome);

    const browserUrl = await new Promise<string>((resolve, reject) => {
      let output = "";

      chrome.stderr?.on("data", (chunk: Buffer) => {
        output += chunk.toString();

        const match = /DevTools listening on (ws:\/\/\S+)/.exec(output);

        if (match?.[1]) resolve(match[1]);
      });
      chrome.on("exit", () =>
        reject(new Error(`Chrome exited before DevTools started:\n${output}`)),
      );
    });

    const connection = await CdpConnection.open(browserUrl);

    const { targetId } = await connection.send("Target.createTarget", targetSchema, {
      url: "about:blank",
    });

    const { sessionId } = await connection.send("Target.attachToTarget", sessionSchema, {
      targetId,
      flatten: true,
    });

    const page = new BrowserPage(connection, sessionId, chrome, targetId);

    await page.send("Page.enable");
    await page.send("Network.enable");
    await page.send("Runtime.enable");
    await page.send("Network.setBlockedURLs", { urls: blockedUrlPatterns });
    await page.send("Emulation.setDeviceMetricsOverride", { ...throttle.viewport, mobile: true });
    await page.send("Page.addScriptToEvaluateOnNewDocument", {
      source: probeSource(readyProbes),
    });

    return page;
  }

  async browserVersion(): Promise<string> {
    return (await this.connection.send("Browser.getVersion", versionSchema)).product;
  }

  webGlRenderer(): Promise<string> {
    return this.evaluate(webGlRendererSource, z.string());
  }

  async setThrottled(isThrottled: boolean): Promise<void> {
    await this.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: isThrottled ? throttle.latencyMs : 0,
      downloadThroughput: isThrottled ? throttle.downloadBytesPerSecond : -1,
      uploadThroughput: isThrottled ? throttle.uploadBytesPerSecond : -1,
    });
    await this.send("Emulation.setCPUThrottlingRate", {
      rate: isThrottled ? throttle.cpuSlowdown : 1,
    });
  }

  async clearForFirstVisit(origin: string): Promise<void> {
    await this.send("Network.clearBrowserCache");
    await this.send("Storage.clearDataForOrigin", {
      origin,
      storageTypes: "local_storage,indexeddb,cache_storage,service_workers",
    });
  }

  async navigate(url: string, timeoutMs: number): Promise<void> {
    let stopListening: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const loaded = new Promise<void>((resolve, reject) => {
      stopListening = this.connection.on("Page.loadEventFired", this.sessionId, noResult, () =>
        resolve(),
      );
      timer = setTimeout(
        () => reject(new Error(`${url} did not fire load within ${timeoutMs} ms.`)),
        timeoutMs,
      );
    });

    this.currentLoaderId = "";
    this.pendingRequests.clear();

    const navigated = this.connection
      .send("Page.navigate", navigationSchema, { url }, this.sessionId)
      .then(({ errorText }) => {
        if (errorText !== undefined) throw new Error(`Navigation to ${url} failed: ${errorText}`);
      });

    try {
      await Promise.all([navigated, loaded]);
    } finally {
      stopListening?.();
      clearTimeout(timer);
    }
  }

  async measure(url: string, expectGlobe: boolean, timeoutMs: number): Promise<Sample> {
    const redirectsBefore = this.counters.documentRedirects;

    this.scriptBytes = 0;
    this.scriptRequests.clear();
    await this.navigate(url, timeoutMs);

    if (!(await this.evaluate(readySource(expectGlobe, timeoutMs), z.boolean())))
      throw new Error(
        `${url} never showed the seeded marks${expectGlobe ? " and a globe frame" : ""} within ${timeoutMs} ms.`,
      );

    const { globeFrame, ...timings } = await this.evaluate(readSampleSource, sampleSchema);

    await this.waitForNetworkIdle(url, timeoutMs);
    this.throwOnDroppedEvents();

    return {
      ...timings,
      globeFrame: expectGlobe ? globeFrame : undefined,
      scriptBytes: this.scriptBytes,
      documentRedirects: this.counters.documentRedirects - redirectsBefore,
    };
  }

  async measureSoftNavigation(fromUrl: string, path: string, timeoutMs: number): Promise<Sample> {
    await this.measure(fromUrl, false, timeoutMs);

    const redirectsBefore = this.counters.documentRedirects;

    const selector = JSON.stringify(`nav[aria-label="Main"]:not(header nav) a[href="${path}"]`);

    if (!(await this.evaluate(`document.querySelector(${selector}) !== null`, z.boolean())))
      throw new Error(`${fromUrl} has no tab bar link to ${path}.`);

    this.scriptBytes = 0;
    this.scriptRequests.clear();

    const timings = await this.evaluate(
      `window.__perfSoftNavigate(${selector}, ${JSON.stringify(path)}, ${timeoutMs})`,
      softNavigationSchema.nullable(),
    );

    if (!timings)
      throw new Error(
        `Clicking the ${path} link on ${fromUrl} did not show the seeded marks and a globe frame within ${timeoutMs} ms.`,
      );

    await this.waitForNetworkIdle(path, timeoutMs);
    this.throwOnDroppedEvents();

    return {
      ...timings,
      scriptBytes: this.scriptBytes,
      documentRedirects: this.counters.documentRedirects - redirectsBefore,
    };
  }

  private throwOnDroppedEvents(): void {
    if (this.droppedEvents.size > 0)
      throw new Error(
        `CDP events did not match their schemas, so the counts are unreliable: ${[...this.droppedEvents].map(([method, count]) => `${method} x${count}`).join(", ")}`,
      );
  }

  get droppedEvents(): ReadonlyMap<string, number> {
    return this.connection.droppedEvents;
  }

  async warmUp(url: string, timeoutMs: number): Promise<void> {
    await this.navigate(url, timeoutMs);
    await this.waitForNetworkIdle(url, timeoutMs);
  }

  private async waitForNetworkIdle(url: string, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    let idleSince = Date.now();

    while (Date.now() - idleSince < networkIdleMs) {
      if (Date.now() > deadline)
        throw new Error(
          `${url} still had requests in flight after ${timeoutMs} ms: ${[...this.pendingRequests.values()].join(", ")}`,
        );

      if (this.pendingRequests.size > 0) idleSince = Date.now();

      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  async evaluate<T>(expression: string, valueSchema: z.ZodType<T>): Promise<T> {
    const evaluation = await this.connection.send(
      "Runtime.evaluate",
      evaluationSchema,
      { expression, returnByValue: true, awaitPromise: true },
      this.sessionId,
    );

    if (evaluation.exceptionDetails)
      throw new Error(`Page script failed: ${evaluation.exceptionDetails.text}`);

    return valueSchema.parse(evaluation.result.value);
  }

  close(): void {
    this.connection.close();
    this.chrome.kill();
  }

  private async send(method: string, params: CdpParams = {}): Promise<void> {
    await this.connection.send(method, noResult, params, this.sessionId);
  }
}
