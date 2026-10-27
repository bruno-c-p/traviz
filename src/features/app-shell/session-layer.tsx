import { Suspense } from "react";
import { KeepClerkSession } from "@/features/auth";
import { getUserId } from "@/features/auth/server";
import { SessionMarks } from "@/features/app-shell/session-marks";
import { TabBar } from "@/features/app-shell/tab-bar";
import { TopBar } from "@/features/app-shell/top-bar";

export async function SessionLayer() {
  const userId = await getUserId();

  if (userId === null) return null;

  return (
    <>
      <TopBar />
      <TabBar />
      <Suspense fallback={null}>
        <SessionMarks />
      </Suspense>
      <KeepClerkSession />
    </>
  );
}
