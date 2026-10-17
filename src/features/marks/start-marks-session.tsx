"use client";

import { useEffect } from "react";
import type { Marks } from "@/features/marks/colors";
import { snapshotFromMarks } from "@/features/marks/marks-sync";
import { useCountriesStore } from "@/features/marks/marks-store";

type StartMarksSessionProps = {
  ownerId: string;
  marks: Promise<Marks>;
};

export function StartMarksSession({ ownerId, marks }: StartMarksSessionProps) {
  useEffect(() => {
    const { startSession, receiveSnapshot } = useCountriesStore.getState();
    startSession(ownerId);
    void snapshotFromMarks(ownerId, marks).then(receiveSnapshot);
  }, [ownerId, marks]);

  return null;
}
