"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type DockItemData = {
  icon: ReactNode;
  label: string;
  href: string;
  className?: string;
};

type DockProps = {
  items: DockItemData[];
  className?: string;
  distance?: number;
  panelHeight?: number;
  baseItemSize?: number;
  magnification?: number;
};

// Touch devices never fire hover, so the magnification effect and
// hover-triggered tooltip are dead weight there — fall back to a static
// size with the label always visible instead of hidden in a tooltip.
function useShowPersistentLabels() {
  const query = "(hover: none), (max-width: 767px)";
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return matches;
}

function magnifiedSize(
  mouseDistance: number,
  distance: number,
  baseItemSize: number,
  magnification: number,
) {
  const closeness = Math.max(0, 1 - Math.abs(mouseDistance) / distance);
  return baseItemSize + (magnification - baseItemSize) * closeness;
}

function DockItem({
  icon,
  label,
  href,
  className,
  size,
  itemRef,
  showPersistentLabel,
}: {
  icon: ReactNode;
  label: string;
  href: string;
  className?: string;
  size: number;
  itemRef: (element: HTMLDivElement | null) => void;
  showPersistentLabel: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        ref={itemRef}
        style={{ width: size, height: size }}
        className={cn(
          "group relative inline-flex cursor-pointer items-center justify-center rounded-xl bg-canvas text-mute transition-[width,height] duration-150 ease-out",
          className,
        )}
      >
        <Link
          href={href}
          aria-label={label}
          className="flex h-full w-full items-center justify-center rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {icon}
        </Link>
        {!showPersistentLabel && (
          <div
            role="tooltip"
            className="pointer-events-none absolute -top-7 left-1/2 w-fit -translate-x-1/2 whitespace-pre rounded-md bg-ink px-2 py-1 text-xs text-canvas-soft opacity-0 shadow-md transition-[opacity,translate] duration-200 group-focus-within:-translate-y-2.5 group-focus-within:opacity-100 group-hover:-translate-y-2.5 group-hover:opacity-100"
          >
            {label}
          </div>
        )}
      </div>
      {showPersistentLabel && <span className="text-[10px] leading-none text-mute">{label}</span>}
    </div>
  );
}

export function Dock({
  items,
  className = "",
  magnification = 70,
  distance = 200,
  panelHeight = 68,
  baseItemSize = 50,
}: DockProps) {
  const showPersistentLabel = useShowPersistentLabels();
  const itemElements = useRef<(HTMLDivElement | null)[]>([]);
  const [itemSizes, setItemSizes] = useState<number[] | null>(null);

  function handleMouseMove({ pageX }: MouseEvent) {
    if (showPersistentLabel) return;
    setItemSizes(
      itemElements.current.map((element) => {
        const left = element?.getBoundingClientRect().x ?? 0;
        return magnifiedSize(
          pageX - left - baseItemSize / 2,
          distance,
          baseItemSize,
          magnification,
        );
      }),
    );
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex items-end justify-center">
      <div
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setItemSizes(null)}
        style={{ height: showPersistentLabel ? undefined : panelHeight }}
        role="toolbar"
        aria-label="Application dock"
        className={cn(
          "pointer-events-auto flex w-fit items-end gap-4 rounded-2xl bg-canvas/90 px-2 pb-2 shadow-lg backdrop-blur-md",
          showPersistentLabel ? "items-center py-2" : "",
          className,
        )}
      >
        {items.map((item, index) => (
          <DockItem
            key={item.label}
            icon={item.icon}
            label={item.label}
            href={item.href}
            className={item.className}
            size={(!showPersistentLabel && itemSizes?.[index]) || baseItemSize}
            itemRef={(element) => {
              itemElements.current[index] = element;
            }}
            showPersistentLabel={showPersistentLabel}
          />
        ))}
      </div>
    </div>
  );
}
