import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { SessionLayer } from "@/components/SessionLayer";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppShell>{children}</AppShell>
      <Suspense fallback={null}>
        <SessionLayer />
      </Suspense>
    </>
  );
}
