export function accountInitial(email: string | null): string | null {
  const initial = email?.trim().charAt(0).toUpperCase() ?? "";

  return initial === "" ? null : initial;
}

export function createAccountMenuLoader<T>(
  load: () => Promise<T | null>,
  reportFailure: (cause: unknown) => void,
) {
  let pending: Promise<T | null> | null = null;

  return (): Promise<T | null> => {
    pending ??= load()
      .catch((cause: unknown) => {
        reportFailure(cause);

        return null;
      })
      .then((menu) => {
        if (menu === null) pending = null;

        return menu;
      });

    return pending;
  };
}
