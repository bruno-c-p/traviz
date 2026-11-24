"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { clerkSession } from "@/features/auth/clerk-session";

export function KeepClerkSession() {
  const router = useRouter();

  useEffect(() => {
    window.__internal_onAfterSetActive = () => router.refresh();
    clerkSession.loadAfterPage();
  }, [router]);

  return null;
}
