import { loadMarks } from "@/features/marks/services/marks";
import { HydrateMarks } from "@/features/marks/hydrate-marks";

export async function MarksProvider({ userId }: { userId: string }) {
  const marks = await loadMarks(userId);

  return <HydrateMarks marks={marks} />;
}
