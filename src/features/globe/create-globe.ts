import { geoInterpolate } from "d3-geo";
import { drawGlobe } from "@/features/globe/draw-globe";
import type { LabelLayouts } from "@/features/globe/draw-globe";
import {
  clampCamera,
  easeInOutCubic,
  easeOutCubic,
  panCamera,
} from "@/features/globe/globe-camera";
import type { Camera, LngLat } from "@/features/globe/globe-camera";
import { createGestureTracker } from "@/features/globe/globe-gestures";
import type { Point } from "@/features/globe/globe-gestures";
import { keyAction } from "@/features/globe/globe-keys";
import { buildMarkers, pickCountry, placeMarkers } from "@/features/globe/globe-markers";
import { buildScene, countryAt, countryOutline, globeView } from "@/features/globe/globe-scene";
import type { CountryTopology, GlobeView } from "@/features/globe/globe-scene";
import type { Marks } from "@/features/marks";
import { countryCenter } from "@/features/countries";
import type { TappedOutline } from "@/features/globe/globe-markers";
import type { MultiLineString } from "geojson";

const MAX_PIXEL_RATIO = 2;
const FLY_MS = 1200;
const ZOOM_MS = 300;
const KEY_PAN_MS = 300;
const INERTIA_LINEARITY = 0.3;
const INERTIA_DECELERATION = 2500;
const INERTIA_MAX_SPEED = 1400;
const LINE_DELTA_PIXELS = 40;

type GlobeOptions = { camera: Camera; prefersReducedMotion: boolean };

type Animation = { durationMs: number; startTime: number | null; step: (progress: number) => void };

export type Globe = ReturnType<typeof createGlobe>;

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");

  if (!context) throw new Error("The globe needs a 2D canvas.");

  return context;
}

export function createGlobe(
  container: HTMLElement,
  topology: CountryTopology,
  { camera: initialCamera, prefersReducedMotion }: GlobeOptions,
) {
  const scene = buildScene(topology);
  const markers = buildMarkers(scene);
  const labelLayouts: LabelLayouts = new Map();
  const canvas = document.createElement("canvas");
  const context = context2d(canvas);

  const fontFamily = getComputedStyle(container).fontFamily;
  const listeners = new AbortController();
  const interactionListeners = new Set<() => void>();
  const countryClickListeners = new Set<(code: string) => void>();

  let camera = clampCamera(initialCamera);
  let marks: Marks = {};
  let selectedCode: string | null = null;
  let selectedOutline: MultiLineString | null = null;
  let size = { width: 0, height: 0 };
  let frameId: number | null = null;
  let animation: Animation | null = null;
  let isLoaded = false;

  canvas.className =
    "block size-full cursor-grab touch-none select-none focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-ink";
  canvas.tabIndex = 0;
  canvas.setAttribute("role", "region");
  canvas.setAttribute("aria-label", "Globe");
  canvas.setAttribute("aria-keyshortcuts", "ArrowUp ArrowDown ArrowLeft ArrowRight + -");
  container.append(canvas);

  function view() {
    return globeView(camera, size.width, size.height);
  }

  function draw() {
    drawGlobe({
      context,
      view: view(),
      camera,
      width: size.width,
      height: size.height,
      scene,
      markers,
      marks,
      selectedCode,
      selectedOutline,
      fontFamily,
      labelLayouts,
    });
    isLoaded = true;
  }

  function frame(now: number) {
    if (animation) {
      animation.startTime ??= now;

      const progress = Math.min((now - animation.startTime) / animation.durationMs, 1);
      const { step } = animation;

      if (progress === 1) animation = null;

      step(progress);
    }

    draw();
    frameId = animation ? requestAnimationFrame(frame) : null;
  }

  function scheduleDraw() {
    if (!listeners.signal.aborted) frameId ??= requestAnimationFrame(frame);
  }

  function setCamera(next: Camera) {
    camera = clampCamera(next);
    scheduleDraw();
  }

  function animate(durationMs: number, step: (progress: number) => void) {
    animation = null;

    if (prefersReducedMotion) {
      step(1);

      return;
    }

    animation = { durationMs, startTime: null, step };
    scheduleDraw();
  }

  function lngLatAt({ x, y }: Point): LngLat | null {
    const { projection, radius } = view();
    const lngLat = projection.invert?.([x, y]);

    return lngLat && Math.hypot(x - size.width / 2, y - size.height / 2) <= radius ? lngLat : null;
  }

  function zoomAround(point: Point, zoom: number) {
    const before = lngLatAt(point);

    camera = clampCamera({ center: camera.center, zoom });

    const after = lngLatAt(point);

    setCamera(
      before && after
        ? {
            center: [
              camera.center[0] + before[0] - after[0],
              camera.center[1] + before[1] - after[1],
            ],
            zoom: camera.zoom,
          }
        : camera,
    );
  }

  function animateZoom(point: Point, zoomDelta: number) {
    const fromZoom = camera.zoom;
    const toZoom = clampCamera({ center: camera.center, zoom: fromZoom + zoomDelta }).zoom;

    animate(ZOOM_MS, (progress) => {
      zoomAround(point, fromZoom + (toZoom - fromZoom) * easeOutCubic(progress));
    });
  }

  function animatePan(durationMs: number, dx: number, dy: number) {
    let travelled = 0;

    animate(durationMs, (progress) => {
      const eased = easeOutCubic(progress);
      const share = eased - travelled;

      travelled = eased;
      setCamera(panCamera(camera, dx * share, dy * share));
    });
  }

  function glide(velocity: Point) {
    const speed = Math.min(
      Math.hypot(velocity.x, velocity.y) * INERTIA_LINEARITY,
      INERTIA_MAX_SPEED,
    );

    if (speed === 0 || prefersReducedMotion) return;

    const seconds = speed / (INERTIA_DECELERATION * INERTIA_LINEARITY);
    const scale = (speed / Math.hypot(velocity.x, velocity.y)) * (seconds / 2);

    animatePan(seconds * 1000, velocity.x * scale, velocity.y * scale);
  }

  function tappedOutline(point: Point, currentView: GlobeView): TappedOutline | null {
    const lngLat = lngLatAt(point);
    const code = lngLat ? countryAt(scene, lngLat) : null;

    if (code === null) return null;

    const center = countryCenter(code);
    const projected = center ? currentView.projection(center) : null;

    return { code, center: projected ? { x: projected[0], y: projected[1] } : null };
  }

  function countryAtPoint(point: Point): string | null {
    const currentView = view();

    return pickCountry(
      placeMarkers(markers, currentView),
      point,
      tappedOutline(point, currentView),
      selectedCode,
    );
  }

  function emitInteraction() {
    for (const listener of interactionListeners) listener();
  }

  const gestures = createGestureTracker({
    begin: () => {
      animation = null;
      emitInteraction();
    },
    pan: (dx, dy) => {
      canvas.style.cursor = "grabbing";
      setCamera(panCamera(camera, dx, dy));
    },
    zoomAround: (point, zoomDelta) => zoomAround(point, camera.zoom + zoomDelta),
    release: (velocity) => {
      canvas.style.cursor = "";
      glide(velocity);
    },
    tap: (point) => {
      const code = countryAtPoint(point);

      if (code) for (const listener of countryClickListeners) listener(code);
    },
    doubleTap: (point) => animateZoom(point, 1),
  });

  function hover(point: Point) {
    canvas.style.cursor = countryAtPoint(point) ? "pointer" : "";
  }

  function bindPointerEvents() {
    const { signal } = listeners;
    const pointOf = (event: MouseEvent): Point => ({ x: event.offsetX, y: event.offsetY });

    canvas.addEventListener(
      "pointerdown",
      (event) => {
        if (event.button !== 0) return;

        canvas.setPointerCapture(event.pointerId);
        gestures.down(event.pointerId, pointOf(event), event.timeStamp);
      },
      { signal },
    );
    canvas.addEventListener(
      "pointermove",
      (event) => {
        const isTracked = gestures.move(event.pointerId, pointOf(event), event.timeStamp);

        if (!isTracked && event.pointerType === "mouse") hover(pointOf(event));
      },
      { signal },
    );
    canvas.addEventListener(
      "pointerup",
      (event) => gestures.up(event.pointerId, pointOf(event), event.timeStamp, false),
      { signal },
    );
    canvas.addEventListener(
      "pointercancel",
      (event) => gestures.up(event.pointerId, pointOf(event), event.timeStamp, true),
      { signal },
    );
    canvas.addEventListener(
      "touchend",
      (event) => {
        if (event.cancelable) event.preventDefault();
      },
      { signal, passive: false },
    );
    canvas.addEventListener(
      "keydown",
      (event) => {
        const action = keyAction(event);

        if (!action) return;

        event.preventDefault();

        if (action.kind === "zoom") {
          zoomBy(action.zoomDelta);
        } else {
          emitInteraction();
          animatePan(KEY_PAN_MS, action.dx, action.dy);
        }
      },
      { signal },
    );
    canvas.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        gestures.wheel(
          pointOf(event),
          event.deltaMode === WheelEvent.DOM_DELTA_LINE
            ? event.deltaY * LINE_DELTA_PIXELS
            : event.deltaY,
        );
      },
      { signal, passive: false },
    );
  }

  function resize(width: number, height: number): boolean {
    const pixelRatio = Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO);
    const pixelWidth = Math.round(width * pixelRatio);

    if (width === size.width && height === size.height && canvas.width === pixelWidth) return false;

    size = { width, height };
    canvas.width = pixelWidth;
    canvas.height = Math.round(height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    return true;
  }

  const resizeObserver = new ResizeObserver(([entry]) => {
    if (entry && resize(entry.contentRect.width, entry.contentRect.height)) draw();
  });

  function watchPixelRatio() {
    window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener(
      "change",
      () => {
        if (resize(size.width, size.height)) draw();

        watchPixelRatio();
      },
      { once: true, signal: listeners.signal },
    );
  }

  bindPointerEvents();
  resizeObserver.observe(container);
  resize(container.clientWidth, container.clientHeight);
  watchPixelRatio();
  scheduleDraw();
  document.fonts.addEventListener(
    "loadingdone",
    () => {
      labelLayouts.clear();
      scheduleDraw();
    },
    { signal: listeners.signal },
  );

  function zoomBy(zoomDelta: number) {
    emitInteraction();
    animateZoom({ x: size.width / 2, y: size.height / 2 }, zoomDelta);
  }

  return {
    getCenter: () => ({ lng: camera.center[0], lat: camera.center[1] }),
    getZoom: () => camera.zoom,
    isMoving: () => gestures.isDragging() || animation !== null,
    isLoaded: () => isLoaded,
    getContainer: () => container,
    project: (lngLat: LngLat): Point => {
      const [x, y] = view().projection(lngLat) ?? [Number.NaN, Number.NaN];

      return { x, y };
    },
    jumpTo: (options: { center?: LngLat; zoom?: number }) => {
      animation = null;
      setCamera({ center: options.center ?? camera.center, zoom: options.zoom ?? camera.zoom });
    },
    flyTo: ({ center, zoom }: Camera) => {
      const from = camera;
      const route = geoInterpolate(from.center, center);

      animate(FLY_MS, (progress) => {
        const eased = easeInOutCubic(progress);

        setCamera({ center: route(eased), zoom: from.zoom + (zoom - from.zoom) * eased });
      });
    },
    zoomIn: () => zoomBy(1),
    zoomOut: () => zoomBy(-1),
    setMarks: (nextMarks: Marks) => {
      marks = nextMarks;
      scheduleDraw();
    },
    setSelectedCode: (code: string | null) => {
      selectedCode = code;
      selectedOutline = countryOutline(scene, code);
      scheduleDraw();
    },
    onUserInteraction: (listener: () => void) => {
      interactionListeners.add(listener);
    },
    onCountryClick: (listener: (code: string) => void) => {
      countryClickListeners.add(listener);
    },
    remove: () => {
      listeners.abort();
      resizeObserver.disconnect();
      animation = null;

      if (frameId !== null) cancelAnimationFrame(frameId);

      frameId = null;
      canvas.remove();
    },
  };
}
