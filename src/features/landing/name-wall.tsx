"use client";

import { Fragment, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { NameButton } from "@/features/landing/name-button";
import { WALL_COUNTRIES } from "@/features/landing/landing-marks";
import { nextWallIndex } from "@/features/landing/wall-keys";

type NameWallProps = { describedBy: string };

export function NameWall({ describedBy }: NameWallProps) {
  const [tabStop, setTabStop] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function moveFocus(event: KeyboardEvent<HTMLDivElement>) {
    const boxes = buttons.current.map(
      (button) => button?.getBoundingClientRect() ?? { left: 0, top: 0, width: 0, height: 0 },
    );

    const next = nextWallIndex(event.key, tabStop, boxes);

    if (next === null) return;

    event.preventDefault();
    setTabStop(next);
    buttons.current[next]?.focus();
  }

  return (
    <div
      id="countries"
      role="group"
      aria-label={`All ${WALL_COUNTRIES.length} countries`}
      aria-describedby={describedBy}
      onKeyDown={moveFocus}
      className="-mx-[0.28em] text-[clamp(1.0625rem,0.55rem+1.15vw,1.75rem)] leading-[1.7] [word-spacing:0.18em] tracking-[-0.012em]"
    >
      {WALL_COUNTRIES.map((country, index) => (
        <Fragment key={country.code}>
          <NameButton
            ref={(button) => {
              buttons.current[index] = button;
            }}
            code={country.code}
            name={country.name}
            isTabStop={index === tabStop}
            onFocus={() => setTabStop(index)}
          />{" "}
        </Fragment>
      ))}
    </div>
  );
}
