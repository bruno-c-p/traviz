import { loadMarks } from "../lib/server/marks";
import { HydrateMarks } from "./HydrateMarks";

export async function MarksProvider({ userId }: { userId: string }) {
  const marks = await loadMarks(userId);
  return <HydrateMarks marks={marks} />;
}
