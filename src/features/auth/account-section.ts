export type AccountSectionView = {
  readonly isSigningOut: boolean;
  readonly signOutFailed: boolean;
};

export type AccountSectionDependencies = {
  readonly signOut: () => Promise<void>;
  readonly show: (view: AccountSectionView) => void;
};

export const SIGN_OUT_LABEL = "Sign out";

export const SIGNING_OUT_LABEL = "Signing out…";

export function createAccountSection({ signOut, show }: AccountSectionDependencies) {
  let view: AccountSectionView = { isSigningOut: false, signOutFailed: false };

  const update = (next: AccountSectionView) => {
    view = next;
    show(view);
  };

  return {
    view: () => view,
    signOut: async () => {
      if (view.isSigningOut) return;

      update({ isSigningOut: true, signOutFailed: false });

      try {
        await signOut();
      } catch {
        update({ isSigningOut: false, signOutFailed: true });
      }
    },
    forgetFailure: () => {
      if (view.signOutFailed) update({ ...view, signOutFailed: false });
    },
  };
}
