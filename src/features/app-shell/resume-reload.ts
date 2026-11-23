export const STALE_AFTER_MS = 5 * 60_000;

type ResumeDependencies = {
  readonly now: () => number;
  readonly isVisible: () => boolean;
  readonly isOnline: () => boolean;
  readonly onVisibilityChange: (listener: () => void) => () => void;
  readonly reload: () => void;
};

export function reloadWhenStale({
  now,
  isVisible,
  isOnline,
  onVisibilityChange,
  reload,
}: ResumeDependencies) {
  let hiddenAt: number | null = isVisible() ? null : now();

  return onVisibilityChange(() => {
    if (!isVisible()) {
      hiddenAt ??= now();

      return;
    }

    const hiddenForMs = hiddenAt === null ? 0 : now() - hiddenAt;

    hiddenAt = null;

    if (hiddenForMs >= STALE_AFTER_MS && isOnline()) reload();
  });
}
