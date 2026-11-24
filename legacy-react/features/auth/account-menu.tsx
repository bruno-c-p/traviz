"use client";

import { X } from "lucide-react";
import { DangerZone, MarkStatus } from "@/features/marks";
import { ThemePicker } from "@/features/theme";
import { AccountSection } from "@/features/auth/account-section";

const SECTION_HEADING_CLASS = "font-mono text-xs uppercase tracking-wider text-mute";

type AccountMenuProps = { headingId: string; onClose: () => void };

export function AccountMenu({ headingId, onClose }: AccountMenuProps) {
  return (
    <div
      className="flex flex-col gap-6 px-5 pt-5"
      style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id={headingId} className="text-xl font-bold tracking-tight text-ink">
          Account
        </h2>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="pressable -mr-1.5 flex size-11 shrink-0 items-center justify-center rounded-full text-body hover:bg-canvas-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
        >
          <X size={20} aria-hidden />
        </button>
      </div>

      <AccountSection />
      <MarkStatus scope="snapshot" className="-mt-3 text-sm" />

      <section className="flex flex-col gap-3">
        <h3 className={SECTION_HEADING_CLASS}>Theme</h3>
        <ThemePicker />
      </section>

      <DangerZone className="border-t border-line pt-5" />
    </div>
  );
}
