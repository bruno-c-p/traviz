import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { AuthPanel } from "@/components/AuthPanel";
import { MarksProvider } from "@/features/marks/components/MarksProvider";
import { getUserId } from "@/lib/server/session";

async function AuthedContent({ children }: { children: React.ReactNode }) {
  const userId = await getUserId();

  if (!userId) return <AuthPanel />;

  return (
    <AppShell>
      <Suspense fallback={null}>
        <MarksProvider userId={userId} />
      </Suspense>
      {children}
    </AppShell>
  );
}

export function SessionGate({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <AuthedContent>{children}</AuthedContent>
    </Suspense>
  );
}
