import { Suspense } from "react";
import { AppShell } from "@/features/app-shell";
import { SessionLayer } from "@/features/app-shell/server";

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
