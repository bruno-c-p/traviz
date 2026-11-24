import { StartMarksSession } from "@/features/marks";
import { loadSessionMarks } from "@/features/marks/server";

export async function SessionMarks() {
  const snapshot = await loadSessionMarks();

  if (snapshot === null) return null;

  return <StartMarksSession snapshot={snapshot} />;
}
