import { databaseMarksReader, loadMarksSnapshot } from "@/features/marks/services/marks";
import { StartMarksSession } from "@/features/marks/start-marks-session";

export function MarksSession({ userId }: { userId: string }) {
  return (
    <StartMarksSession ownerId={userId} snapshot={loadMarksSnapshot(databaseMarksReader, userId)} />
  );
}
