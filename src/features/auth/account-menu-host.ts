import type { MarksStore } from "@/features/marks";

export type AccountSession = {
  readonly email: () => string | null;
  readonly subscribe: (listener: () => void) => () => void;
  readonly signOut: (redirectUrl: string, onSignedOut: () => void) => Promise<void>;
};

export type AccountMenuHost = {
  readonly session: AccountSession;
  readonly marks: MarksStore;
};

declare global {
  interface Window {
    travizAccountMenu?: AccountMenuHost;
  }
}

export const ACCOUNT_MENU_SELECTOR = "dialog[data-account-menu]";
