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

export type Sample = z.infer<typeof sampleSchema> & {
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
    for (const context of [WebGLRenderingContext, WebGL2RenderingContext]) {
      const { drawArrays, drawElements } = context.prototype;
      const record = () => {
        marks.globeFrame ??= performance.now();
        context.prototype.drawArrays = drawArrays;
        context.prototype.drawElements = drawElements;
      };
      context.prototype.drawArrays = function (...args) { record(); return drawArrays.apply(this, args); };
      context.prototype.drawElements = function (...args) { record(); return drawElements.apply(this, args); };
    }
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

    if (this.droppedEvents.size > 0)
      throw new Error(
        `CDP events did not match their schemas, so the counts are unreliable: ${[...this.droppedEvents].map(([method, count]) => `${method} x${count}`).join(", ")}`,
      );

    return {
      ...timings,
      globeFrame: expectGlobe ? globeFrame : undefined,
      scriptBytes: this.scriptBytes,
      documentRedirects: this.counters.documentRedirects - redirectsBefore,
    };
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
