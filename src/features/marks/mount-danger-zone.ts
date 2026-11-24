import { createDangerZone } from "@/features/marks/danger-zone";
import type { DangerZoneView } from "@/features/marks/danger-zone";
import { mountMarkStatusLine } from "@/features/marks/mark-status-line";
import type { MarksStore } from "@/features/marks/marks-store";

const RESET_SCOPE = "all-marks";

export function mountDangerZone(section: HTMLElement, store: MarksStore) {
  const confirmation = section.querySelector<HTMLElement>("[data-reset-confirmation]");
  const askButton = section.querySelector<HTMLElement>("[data-reset-ask]");
  const status = section.querySelector<HTMLElement>("[data-reset-status]");
  const done = section.querySelector<HTMLElement>("[data-reset-done]");

  if (!confirmation || !askButton || !status || !done) return () => {};

  const hasResetProblem = () =>
    store.getState().problems.some((problem) => problem.scope === RESET_SCOPE);

  const show = ({ isConfirming, isResetDone }: DangerZoneView) => {
    confirmation.hidden = !isConfirming;
    askButton.hidden = isConfirming;
    done.hidden = !isResetDone || hasResetProblem();
  };

  const dangerZone = createDangerZone({
    resetAll: () => store.getState().resetAll(),
    show,
  });

  askButton.addEventListener("click", dangerZone.askToReset);

  confirmation
    .querySelector("[data-reset-confirm]")
    ?.addEventListener("click", dangerZone.confirmReset);

  confirmation.querySelector("[data-reset-cancel]")?.addEventListener("click", dangerZone.cancel);
  mountMarkStatusLine(status, store, RESET_SCOPE, "text-sm");
  store.subscribe(() => show(dangerZone.view()));

  return dangerZone.forget;
}
