import { loadMarksSnapshot } from "@/features/marks/services/marks";
import { StartMarksSession } from "@/features/marks/start-marks-session";
import { turso } from "@/shared/server/database";

export function MarksSession({ userId }: { userId: string }) {
  return <StartMarksSession ownerId={userId} snapshot={loadMarksSnapshot(turso, userId)} />;
}
