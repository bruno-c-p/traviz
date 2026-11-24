import type { Marks } from "@/features/marks";
import { progressModel, progressTotalText } from "@/features/stats/progress-model";

function setText(element: Element | null, text: string) {
  if (element !== null && element.textContent !== text) element.textContent = text;
}

function part(card: HTMLElement, name: string): HTMLElement | null {
  return card.querySelector<HTMLElement>(`[data-progress="${name}"]`);
}

export function renderProgressCards(
  root: ParentNode,
  pool: readonly { code: string }[],
  marks: Marks,
) {
  const model = progressModel(pool, marks);

  for (const card of root.querySelectorAll<HTMLElement>("[data-progress-card]")) {
    const variant = card.dataset.progressCard === "peek" ? "peek" : "panel";

    setText(part(card, "visited"), String(model.visited));
    setText(part(card, "total"), progressTotalText(model, variant));
    setText(part(card, "percent"), model.percentText);
    setText(part(card, "want"), String(model.want));
    setText(part(card, "excluded"), String(model.excluded));
    part(card, "reachable")?.style.setProperty("width", `${model.reachableWidth}%`);
    part(card, "bar")?.style.setProperty("transform", `translateX(${model.visitedOffset}%)`);
    part(card, "excluded-bar")?.toggleAttribute("hidden", model.excluded === 0);

    if (variant === "peek") card.setAttribute("aria-label", model.summary);
  }
}
