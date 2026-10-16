import { Suspense } from "react";
import { TabBar } from "@/features/app-shell/tab-bar";
import { TopBar } from "@/features/app-shell/top-bar";
import { MarksProvider } from "@/features/marks/server";
import { getUserId } from "@/features/auth/server";

export async function SessionLayer() {
  const userId = await getUserId();

  if (!userId) return null;

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
