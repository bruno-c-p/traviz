import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { AuthPanel } from "@/components/AuthPanel";
import { MarksProvider } from "@/components/MarksProvider";
import { getSession } from "@/lib/server/session";

async function AuthedContent({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) return <AuthPanel />;

  return (
    <AppShell>
      <Suspense fallback={null}>
        <MarksProvider userId={session.user.id} />
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
