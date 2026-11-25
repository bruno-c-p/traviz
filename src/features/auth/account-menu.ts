import { ACCOUNT_MENU_SELECTOR } from "@/features/auth/account-menu-host";
import type { AccountMenuHost } from "@/features/auth/account-menu-host";
import {
  SIGNING_OUT_LABEL,
  SIGN_OUT_LABEL,
  createAccountSection,
} from "@/features/auth/account-section";
import type { AccountSectionView } from "@/features/auth/account-section";
import { mountDangerZone, mountMarkStatusLine } from "@/features/marks/core";
import { chooseTheme, subscribeTheme, themeChoice } from "@/features/theme";
import { mountThemePicker } from "@/features/theme/core";
import { signInPath } from "@/paths";

function mountAccountSection(dialog: HTMLElement, host: AccountMenuHost) {
  const email = dialog.querySelector<HTMLElement>("[data-account-email]");
  const button = dialog.querySelector<HTMLButtonElement>("[data-sign-out]");
  const label = dialog.querySelector<HTMLElement>("[data-sign-out-label]");
  const failure = dialog.querySelector<HTMLElement>("[data-sign-out-failed]");

  if (!email || !button || !label || !failure) return () => {};

  const showEmail = () => {
    email.textContent = host.session.email() ?? "";
  };

  const show = ({ isSigningOut, signOutFailed }: AccountSectionView) => {
    button.disabled = isSigningOut;
    label.textContent = isSigningOut ? SIGNING_OUT_LABEL : SIGN_OUT_LABEL;
    failure.hidden = !signOutFailed;
  };

  const section = createAccountSection({
    signOut: () => host.session.signOut(signInPath(), () => host.marks.getState().endSession()),
    show,
  });

  button.addEventListener("click", () => void section.signOut());
  host.session.subscribe(showEmail);
  showEmail();

  return section.forgetFailure;
}

function mountAccountMenu(dialog: HTMLDialogElement, host: AccountMenuHost) {
  const snapshotStatus = dialog.querySelector<HTMLElement>("[data-snapshot-status]");
  const themePicker = dialog.querySelector<HTMLElement>("[data-theme-picker]");
  const dangerZone = dialog.querySelector<HTMLElement>("[data-danger-zone]");
  const forgetSignOutFailure = mountAccountSection(dialog, host);
  const forgetReset = dangerZone === null ? () => {} : mountDangerZone(dangerZone, host.marks);

  if (snapshotStatus !== null) {
    mountMarkStatusLine(snapshotStatus, host.marks, "snapshot", "text-sm");
  }

  if (themePicker !== null) {
    mountThemePicker(themePicker, {
      choice: themeChoice,
      choose: chooseTheme,
      subscribe: subscribeTheme,
    });
  }

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  dialog
    .querySelector("[data-account-menu-close]")
    ?.addEventListener("click", () => dialog.close());

  dialog.addEventListener("close", () => {
    forgetSignOutFailure();
    forgetReset();
  });
}

export function startAccountMenu() {
  const dialog = document.querySelector<HTMLDialogElement>(ACCOUNT_MENU_SELECTOR);
  const host = window.travizAccountMenu;

  if (dialog === null || host === undefined || dialog.dataset.mounted !== undefined) return;

  dialog.dataset.mounted = "";
  mountAccountMenu(dialog, host);
}
