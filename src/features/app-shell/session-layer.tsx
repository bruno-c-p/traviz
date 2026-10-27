import { TabBar } from "@/features/app-shell/tab-bar";
import { TopBar } from "@/features/app-shell/top-bar";
import { StartMarksSession } from "@/features/marks";
import { loadSessionMarks } from "@/features/marks/server";

export async function SessionLayer() {
  const snapshot = await loadSessionMarks();

  if (snapshot === null) return null;

  return (
    <>
      <TopBar />
      <TabBar />
      <StartMarksSession snapshot={snapshot} />
    </>
  );
}
