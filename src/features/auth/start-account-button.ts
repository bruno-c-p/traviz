import { ACCOUNT_MENU_SELECTOR } from "@/features/auth/account-menu-host";
import { accountInitial, createAccountMenuLoader } from "@/features/auth/account-menu-loader";
import { clerkSession } from "@/features/auth/clerk-session";
import { marksStore } from "@/features/marks";
import { accountMenuFragmentPath } from "@/paths";

const BUTTON_SELECTOR = "[data-account-button]";

function isOnAccountButton(event: Event): boolean {
  return event.target instanceof Element && event.target.closest(BUTTON_SELECTOR) !== null;
}

function showExpanded(isExpanded: boolean) {
  for (const button of document.querySelectorAll(BUTTON_SELECTOR)) {
    button.setAttribute("aria-expanded", isExpanded ? "true" : "false");
  }
}

function showInitial() {
  const root = document.documentElement;
  const initial = accountInitial(clerkSession.email());

  root.toggleAttribute("data-account-initial", initial !== null);
  root.style.setProperty("--account-initial", JSON.stringify(initial ?? ""));
}

async function fetchAccountMenu(): Promise<HTMLDialogElement | null> {
  const response = await fetch(accountMenuFragmentPath(), { credentials: "same-origin" });

  if (response.redirected) window.location.reload();

  if (!response.ok || response.redirected) return null;

  const menu = document.createRange().createContextualFragment(await response.text());
  const dialog = menu.querySelector<HTMLDialogElement>(ACCOUNT_MENU_SELECTOR);

  if (dialog === null) return null;

  dialog.addEventListener("close", () => showExpanded(false));
  document.body.append(menu);

  return dialog;
}

export function startAccountButton() {
  const loadMenu = createAccountMenuLoader(fetchAccountMenu, (cause: unknown) => {
    console.error("The account menu could not load.", cause);
  });

  const openMenu = async () => {
    const dialog = await loadMenu();

    if (dialog === null || dialog.open) return;

    dialog.showModal();
    showExpanded(true);
  };

  window.travizAccountMenu = { session: clerkSession, marks: marksStore };
  clerkSession.subscribe(showInitial);

  document.addEventListener("click", (event) => {
    if (isOnAccountButton(event)) void openMenu();
  });

  for (const intent of ["pointerover", "focusin"]) {
    document.addEventListener(intent, (event) => {
      if (isOnAccountButton(event)) void loadMenu();
    });
  }
}
