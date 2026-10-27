import { Minus, Plus } from "lucide-react";
import { cn } from "@/shared/cn";

type ZoomControlsProps = {
  onZoomIn: () => void;
  onZoomOut: () => void;
  className?: string;
};

const ZOOM_BUTTON_CLASS =
  "flex size-11 items-center justify-center rounded-xl text-ink pressable hover:bg-canvas-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink";

export function ZoomControls({ onZoomIn, onZoomOut, className }: ZoomControlsProps) {
  return (
    <div
      role="group"
      aria-label="Zoom"
      className={cn("flex-col gap-1 rounded-2xl bg-canvas p-1 shadow-float", className)}
    >
      <button type="button" aria-label="Zoom in" onClick={onZoomIn} className={ZOOM_BUTTON_CLASS}>
        <Plus size={18} aria-hidden />
      </button>
      <button type="button" aria-label="Zoom out" onClick={onZoomOut} className={ZOOM_BUTTON_CLASS}>
        <Minus size={18} aria-hidden />
      </button>
    </div>
  );
}
