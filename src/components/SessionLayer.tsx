import { Suspense } from "react";
import { AuthPanel } from "@/components/AuthPanel";
import { TabBar } from "@/components/tab-bar";
import { TopBar } from "@/components/top-bar";
import { MarksProvider } from "@/features/marks/components/MarksProvider";
import { getUserId } from "@/lib/server/session";

export async function SessionLayer() {
  const userId = await getUserId();

  if (!userId) return <AuthPanel />;

  return (
    <>
      <TopBar />
      <TabBar />
      <Suspense fallback={null}>
        <MarksProvider userId={userId} />
      </Suspense>
    </>
  );
}
