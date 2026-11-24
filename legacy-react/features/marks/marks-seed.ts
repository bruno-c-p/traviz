import { createContext } from "react";
import type { MarksSnapshot } from "@/features/marks/marks-sync";

export type MarksSeed = Promise<MarksSnapshot | null>;

export const MarksSeedContext = createContext<MarksSeed | null>(null);
