import type { Marks, MarksStore } from "@/features/marks";
import { decodeContinentCodes, statsModel } from "@/features/stats/stats-model";
import type { ContinentStats, StatsModel } from "@/features/stats/stats-model";

function setText(element: Element | null, text: string) {
  if (element !== null && element.textContent !== text) element.textContent = text;
}

function stat(root: ParentNode, name: string): HTMLElement | null {
  return root.querySelector<HTMLElement>(`[data-stat="${name}"]`);
}

function renderContinent(card: HTMLElement, continent: ContinentStats) {
  setText(stat(card, "count"), continent.countText);
  setText(stat(card, "summary"), continent.summary);

  card.querySelectorAll<HTMLElement>('[data-stat="share"]').forEach((bar, index) => {
    bar.style.width = `${continent.shares[index] ?? 0}%`;
  });
}

function renderStats(host: HTMLElement, model: StatsModel) {
  setText(stat(host, "visited"), String(model.visited));
  setText(stat(host, "total"), model.totalText);
  setText(stat(host, "want"), String(model.want));
  setText(stat(host, "not-interested"), String(model.notInterested));
  setText(stat(host, "excluded-text"), model.excludedText);
  stat(host, "reachable")?.style.setProperty("width", `${model.reachableWidth}%`);
  stat(host, "bar")?.style.setProperty("transform", `translateX(${model.visitedOffset}%)`);
  stat(host, "excluded-bar")?.toggleAttribute("hidden", model.excluded === 0);
  stat(host, "excluded-text")?.toggleAttribute("hidden", model.excluded === 0);

  const cards = host.querySelectorAll<HTMLElement>("[data-stat-continent]");

  cards.forEach((card, index) => {
    const continent = model.continents[index];

    if (continent !== undefined) renderContinent(card, continent);
  });
}

export function mountStatsView(host: HTMLElement, store: MarksStore) {
  const pools = decodeContinentCodes(
    host.querySelector("[data-continent-codes]")?.textContent ?? "",
  );

  let shownMarks: Marks | null = null;
  let isShown = false;

  const render = () => {
    const { marks } = store.getState();

    if (marks === shownMarks) return;

    shownMarks = marks;
    renderStats(host, statsModel(pools, marks));
  };

  store.subscribe(() => {
    if (isShown) render();
  });

  return {
    showView: () => {
      isShown = true;
      render();
    },
    hideView: () => {
      isShown = false;
    },
  };
}
