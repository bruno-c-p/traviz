export {
  COUNTRY_STATES,
  STATE_COLORS,
  STATE_LABELS,
  STATE_ON_COLORS,
  STATE_SHORT_LABELS,
} from "@/features/marks/colors";

export type { CountryState, Marks, StateColorKey } from "@/features/marks/colors";

export { tallyMarks, tallyShare, tallyTotal } from "@/features/marks/tally";

export type { Tally } from "@/features/marks/tally";

export { endMarksSession, marksStore } from "@/features/marks/marks-store";

export type { MarksStore, MarksStoreState, SavingScopes } from "@/features/marks/marks-store";

export type { MarksSnapshot, SyncProblem } from "@/features/marks/marks-sync";

export { markStatusText } from "@/features/marks/mark-status";

export { mountMarkControls } from "@/features/marks/mark-controls";

export { MARKS_SNAPSHOT_ID, startMarksSession } from "@/features/marks/start-marks-session";

export { replayEarlyTaps, takeEarlyTaps } from "@/features/marks/early-taps";
