"use client";

import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from "motion/react";
import type { MotionValue, SpringOptions } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

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
  dockHeight?: number;
  magnification?: number;
  spring?: SpringOptions;
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

function DockLabel({ isHovered, children }: { isHovered: MotionValue<number>; children: ReactNode }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => isHovered.on("change", (latest) => setIsVisible(latest === 1)), [isHovered]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 0 }}
          animate={{ opacity: 1, y: -10 }}
          exit={{ opacity: 0, y: 0 }}
          transition={{ duration: 0.2 }}
          role="tooltip"
          style={{ x: "-50%" }}
          className="pointer-events-none absolute -top-7 left-1/2 w-fit whitespace-pre rounded-md bg-ink px-2 py-1 text-xs text-canvas-soft shadow-md"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DockItem({
  icon,
  label,
  href,
  className,
  mouseX,
  spring,
  distance,
  magnification,
  baseItemSize,
  showPersistentLabel,
}: {
  icon: ReactNode;
  label: string;
  href: string;
  className?: string;
  mouseX: MotionValue<number>;
  spring: SpringOptions;
  distance: number;
  magnification: number;
  baseItemSize: number;
  showPersistentLabel: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isHovered = useMotionValue(0);

  const mouseDistance = useTransform(mouseX, (val) => {
    const rect = ref.current?.getBoundingClientRect() ?? { x: 0, width: baseItemSize };
    return val - rect.x - baseItemSize / 2;
  });

  const targetSize = useTransform(mouseDistance, [-distance, 0, distance], [baseItemSize, magnification, baseItemSize]);
  const size = useSpring(targetSize, spring);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <motion.div
        ref={ref}
        style={showPersistentLabel ? { width: baseItemSize, height: baseItemSize } : { width: size, height: size }}
        onHoverStart={() => isHovered.set(1)}
        onHoverEnd={() => isHovered.set(0)}
        className={[
          "relative inline-flex cursor-pointer items-center justify-center rounded-xl bg-canvas text-mute",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <Link
          href={href}
          aria-label={label}
          onFocus={() => isHovered.set(1)}
          onBlur={() => isHovered.set(0)}
          className="flex h-full w-full items-center justify-center rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {icon}
        </Link>
        {!showPersistentLabel && <DockLabel isHovered={isHovered}>{label}</DockLabel>}
      </motion.div>
      {showPersistentLabel && <span className="text-[10px] leading-none text-mute">{label}</span>}
    </div>
  );
}

export function Dock({
  items,
  className = "",
  spring = { mass: 0.1, stiffness: 150, damping: 12 },
  magnification = 70,
  distance = 200,
  panelHeight = 68,
  dockHeight = 256,
  baseItemSize = 50,
}: DockProps) {
  const mouseX = useMotionValue(Infinity);
  const isHovered = useMotionValue(0);
  const showPersistentLabel = useShowPersistentLabels();

  const maxHeight = Math.max(dockHeight, magnification + magnification / 2 + 4);
  const heightRow = useTransform(isHovered, [0, 1], [panelHeight, maxHeight]);
  const height = useSpring(heightRow, spring);

  return (
    <motion.div
      style={{ height: showPersistentLabel ? undefined : height }}
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex items-end justify-center"
    >
      <motion.div
        onMouseMove={({ pageX }) => {
          if (showPersistentLabel) return;
          isHovered.set(1);
          mouseX.set(pageX);
        }}
        onMouseLeave={() => {
          isHovered.set(0);
          mouseX.set(Infinity);
        }}
        style={{ height: showPersistentLabel ? undefined : panelHeight }}
        role="toolbar"
        aria-label="Application dock"
        className={[
          "pointer-events-auto flex w-fit items-end gap-4 rounded-2xl bg-canvas/90 px-2 pb-2 shadow-lg backdrop-blur-md",
          showPersistentLabel ? "items-center py-2" : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {items.map((item) => (
          <DockItem
            key={item.label}
            icon={item.icon}
            label={item.label}
            href={item.href}
            className={item.className}
            mouseX={mouseX}
            spring={spring}
            distance={distance}
            magnification={magnification}
            baseItemSize={baseItemSize}
            showPersistentLabel={showPersistentLabel}
          />
        ))}
      </motion.div>
    </motion.div>
  );
}
