"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Odświeża stronę co kilka sekund – np. czekając na webhook ze Stripe. */
export function AutoRefresh({ everyMs = 3000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), everyMs);
    return () => clearInterval(timer);
  }, [router, everyMs]);
  return null;
}
