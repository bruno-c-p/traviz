"use client";

import { useEffect } from "react";
import type { MarksSnapshot } from "@/features/marks/marks-sync";
import { useCountriesStore } from "@/features/marks/marks-store";

type StartMarksSessionProps = {
  ownerId: string;
  snapshot: Promise<MarksSnapshot>;
};

export function StartMarksSession({ ownerId, snapshot }: StartMarksSessionProps) {
  useEffect(() => {
    const { startSession, receiveSnapshot } = useCountriesStore.getState();
    startSession(ownerId);
    void snapshot.then(receiveSnapshot);
  }, [ownerId, snapshot]);

  return null;
}
