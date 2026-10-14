import { Suspense } from "react";
import { AppNav } from "@/components/AppNav";
import { AuthPanel } from "@/components/AuthPanel";
import { FirstRunHint } from "@/components/FirstRunHint";
import { MarksProvider } from "@/features/marks/components/MarksProvider";
import { getUserId } from "@/lib/server/session";

export async function SessionLayer() {
  const userId = await getUserId();

  if (!userId) return <AuthPanel />;

  return (
    <>
      <AppNav />
      <FirstRunHint />
      <Suspense fallback={null}>
        <MarksProvider userId={userId} />
      </Suspense>
    </>
  );
}
