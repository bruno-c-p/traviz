import {
  laterViews,
  navLinkClass,
  navigationItem,
  parseNavPlacement,
  parseViewName,
  viewForPath,
  viewsToPrefetch,
} from "@/features/app-shell/navigation";
import type { ViewName } from "@/features/app-shell/navigation";
import type { MountedView } from "@/shared/view";

export type ViewMounts = Record<ViewName, (host: HTMLElement) => MountedView>;

const INACTIVE_CLASS = "view-inactive";
const PANEL_BEHIND_GLOBE_CLASSES = ["invisible", "pointer-events-none"];
const TOP_BAR_FILL_CLASS = "bg-canvas-soft";
const IDLE_FALLBACK_MS = 200;

function whenIdle(callback: () => void) {
  if (typeof window.requestIdleCallback === "undefined") setTimeout(callback, IDLE_FALLBACK_MS);
  else window.requestIdleCallback(callback);
}

function isPlainClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

function linkedView(event: Event): ViewName | null {
  const link =
    event.target instanceof Element ? event.target.closest<HTMLElement>("[data-view-link]") : null;

  return parseViewName(link?.dataset.viewLink);
}

export function startViewRouter(mounts: ViewMounts) {
  const panel = document.querySelector<HTMLElement>("[data-panel-scroll]");
  const globeSlot = document.querySelector<HTMLElement>("[data-globe-slot]");
  const topBar = document.querySelector<HTMLElement>("[data-top-bar]");
  const hosts = new Map<ViewName, HTMLElement>();
  const mounted = new Map<ViewName, MountedView>();
  const scrollTops = new Map<ViewName, number>();
  const loads = new Map<ViewName, Promise<boolean>>();
  let activeView: ViewName | null = null;

  if (panel === null || globeSlot === null) return;

  const mount = (view: ViewName, host: HTMLElement) => {
    hosts.set(view, host);
    mounted.set(view, mounts[view](host));
  };

  const insert = (view: ViewName, host: HTMLElement) => {
    if (view === "globe") {
      globeSlot.append(host);

      return;
    }

    const following = laterViews(view).flatMap((later) => hosts.get(later) ?? []);

    panel.insertBefore(host, following.find((later) => later.parentElement === panel) ?? null);
  };

  const renderChrome = (view: ViewName) => {
    for (const link of document.querySelectorAll<HTMLElement>("[data-view-link][data-nav]")) {
      const isActive = link.dataset.viewLink === view;

      link.className = navLinkClass(parseNavPlacement(link.dataset.nav), isActive);

      if (isActive) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }

    for (const className of PANEL_BEHIND_GLOBE_CLASSES) {
      panel.classList.toggle(className, view === "globe");
    }

    topBar?.classList.toggle(TOP_BAR_FILL_CLASS, view !== "globe");
    topBar
      ?.querySelector("[data-top-bar-globe-tools]")
      ?.toggleAttribute("hidden", view !== "globe");
  };

  const show = (view: ViewName) => {
    const host = hosts.get(view);

    if (host === undefined || activeView === view) return;

    if (activeView !== null) {
      scrollTops.set(activeView, panel.scrollTop);
      hosts.get(activeView)?.classList.add(INACTIVE_CLASS);
      mounted.get(activeView)?.hideView();
    }

    activeView = view;
    host.classList.remove(INACTIVE_CLASS);
    renderChrome(view);
    panel.scrollTop = scrollTops.get(view) ?? 0;
    mounted.get(view)?.showView();
  };

  const fetchView = async (view: ViewName): Promise<boolean> => {
    const { fragment } = navigationItem(view);
    const response = await fetch(fragment, { credentials: "same-origin" });

    if (!response.ok || response.redirected) return false;

    const template = document.createElement("template");

    template.innerHTML = await response.text();

    const host = template.content.querySelector<HTMLElement>(`[data-view="${view}"]`);

    if (host === null) return false;

    if (!hosts.has(view)) {
      host.classList.add(INACTIVE_CLASS);
      insert(view, host);
      mount(view, host);
    }

    return true;
  };

  const loadView = (view: ViewName): Promise<boolean> => {
    if (hosts.has(view)) return Promise.resolve(true);

    const pending =
      loads.get(view) ??
      fetchView(view).catch((cause: unknown) => {
        console.error(`The ${view} view could not load.`, cause);

        return false;
      });

    loads.set(view, pending);
    void pending.then((isLoaded) => {
      if (!isLoaded) loads.delete(view);
    });

    return pending;
  };

  const navigate = (view: ViewName) => {
    if (activeView === view) return;

    show(view);
    history.pushState(null, "", navigationItem(view).href);
  };

  const navigateWhenLoaded = async (view: ViewName) => {
    if (await loadView(view)) navigate(view);
    else window.location.assign(navigationItem(view).href);
  };

  for (const host of document.querySelectorAll<HTMLElement>("[data-view]")) {
    const view = parseViewName(host.dataset.view);

    if (view !== null) mount(view, host);
  }

  const firstView = viewForPath(window.location.pathname) ?? [...hosts.keys()][0];

  if (firstView !== undefined) show(firstView);

  document.addEventListener("pointerdown", (event) => {
    const view = linkedView(event);

    if (view === null || !isPlainClick(event) || view === activeView) return;

    if (hosts.has(view)) navigate(view);
    else void loadView(view);
  });

  document.addEventListener("click", (event) => {
    const view = linkedView(event);

    if (view === null || !isPlainClick(event)) return;

    event.preventDefault();
    void navigateWhenLoaded(view);
  });

  window.addEventListener("popstate", () => {
    const view = viewForPath(window.location.pathname);

    if (view === null) {
      window.location.reload();

      return;
    }

    void loadView(view).then((isLoaded) => {
      if (isLoaded) show(view);
      else window.location.reload();
    });
  });

  const prefetchOthers = () =>
    whenIdle(() => {
      void viewsToPrefetch([...hosts.keys()]).reduce(
        (previous, view) => previous.then(() => loadView(view)),
        Promise.resolve(true),
      );
    });

  if (document.readyState === "complete") prefetchOthers();
  else window.addEventListener("load", prefetchOthers, { once: true });
}
