"use client";

import { useEffect } from "react";
import type { Marks } from "@/features/marks/colors";
import { useCountriesStore } from "@/features/marks/marks-store";

export function HydrateMarks({ marks }: { marks: Marks }) {
  useEffect(() => {
    useCountriesStore.getState().syncMarks(marks);

    return () => {
      useCountriesStore.getState().clearLocal();
    };
  }, [marks]);

  return null;
}
