"use client";

import { useEffect } from "react";
import type { MarksSnapshot } from "@/features/marks/marks-sync";
import { useCountriesStore } from "@/features/marks/marks-store";

export function StartMarksSession({ snapshot }: { snapshot: MarksSnapshot }) {
  useEffect(() => {
    const { startSession, receiveSnapshot } = useCountriesStore.getState();
    startSession(snapshot.ownerId);
    receiveSnapshot(snapshot);
  }, [snapshot]);

  return null;
}
