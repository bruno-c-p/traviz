export type DangerZoneView = {
  readonly isConfirming: boolean;
  readonly isResetDone: boolean;
};

export type DangerZoneDependencies = {
  readonly resetAll: () => void;
  readonly show: (view: DangerZoneView) => void;
};

const IDLE: DangerZoneView = { isConfirming: false, isResetDone: false };

export function createDangerZone({ resetAll, show }: DangerZoneDependencies) {
  let view = IDLE;

  const update = (next: DangerZoneView) => {
    view = next;
    show(view);
  };

  return {
    view: () => view,
    askToReset: () => update({ isConfirming: true, isResetDone: false }),
    cancel: () => update({ ...view, isConfirming: false }),
    confirmReset: () => {
      if (!view.isConfirming) return;

      resetAll();
      update({ isConfirming: false, isResetDone: true });
    },
    forget: () => update(IDLE),
  };
}
