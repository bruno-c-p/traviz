import { Suspense } from "react";
import { AppShell } from "@/features/app-shell";
import { SessionLayer } from "@/features/app-shell/server";
import { MarksSeedProvider } from "@/features/marks";
import { loadSessionMarks } from "@/features/marks/server";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <MarksSeedProvider seed={loadSessionMarks()}>
      <AppShell>{children}</AppShell>
      <Suspense fallback={null}>
        <SessionLayer />
      </Suspense>
    </MarksSeedProvider>
  );
}
