"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-renders the list every few seconds while a file is still in quarantine. */
export function RefreshWhileScanning({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(timer);
  }, [active, router]);
  return null;
}
