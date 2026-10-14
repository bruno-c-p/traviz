"use client";

import { useEffect } from "react";
import type { Marks } from "@/lib/colors";
import { useCountriesStore } from "@/store/countries";

export function HydrateMarks({ marks }: { marks: Marks }) {
  useEffect(() => {
    useCountriesStore.setState({ marks, status: "ready" });

    return () => {
      useCountriesStore.getState().clearLocal();
    };
  }, [marks]);

  return null;
}
