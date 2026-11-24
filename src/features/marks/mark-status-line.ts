import { markStatusText } from "@/features/marks/mark-status";
import type { MarksStore, MarksStoreState } from "@/features/marks/marks-store";
import { iconClass } from "@/shared/icons/icons";

const DISMISS_BUTTON_CLASS =
  "pressable flex size-6 shrink-0 items-center justify-center rounded-full hover:bg-canvas-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink";

function statusLine(className: string) {
  const line = document.createElement("p");

  line.setAttribute("role", "status");
  line.className = className;

  return line;
}

function problemLine(text: string, sizeClass: string, dismiss: () => void) {
  const line = statusLine(`flex min-w-0 items-center gap-1 text-negative-text ${sizeClass}`);
  const label = document.createElement("span");
  const button = document.createElement("button");
  const icon = document.createElement("span");

  label.className = "min-w-0 truncate";
  label.textContent = text;
  button.type = "button";
  button.className = DISMISS_BUTTON_CLASS;
  button.setAttribute("aria-label", "Dismiss");
  button.addEventListener("click", dismiss);
  icon.className = iconClass("cross-2", "size-3");
  icon.setAttribute("aria-hidden", "true");
  button.append(icon);
  line.append(label, button);

  return line;
}

export function mountMarkStatusLine(
  host: HTMLElement,
  store: MarksStore,
  scope: string,
  sizeClass: string,
) {
  let shown = "";

  const show = ({ saving, problems, dismissProblem }: MarksStoreState) => {
    const status = markStatusText(scope, saving, problems);
    const key = status === null ? "" : `${status.kind} ${status.text}`;

    if (key === shown) return;

    shown = key;

    if (status === null) host.replaceChildren();
    else if (status.kind === "saving") {
      const line = statusLine(`text-mute ${sizeClass}`);

      line.textContent = status.text;
      host.replaceChildren(line);
    } else host.replaceChildren(problemLine(status.text, sizeClass, () => dismissProblem(scope)));
  };

  show(store.getState());

  return store.subscribe(show);
}
