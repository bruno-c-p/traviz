import { loadMarks } from "@/features/marks/services/marks";
import { HydrateMarks } from "@/features/marks/components/HydrateMarks";

export async function MarksProvider({ userId }: { userId: string }) {
  const marks = await loadMarks(userId);

  return <HydrateMarks marks={marks} />;
}
