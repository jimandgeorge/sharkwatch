"use client";

import { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

export default function AutoRefresh({ intervalMs = 15_000 }: { intervalMs?: number }) {
  const router = useRouter();

  const refresh = useCallback(() => router.refresh(), [router]);

  useEffect(() => {
    const id = setInterval(refresh, intervalMs);
    return () => clearInterval(id);
  }, [refresh, intervalMs]);

  return (
    <button
      onClick={refresh}
      className="text-[12px] text-zinc-600 hover:text-zinc-300 transition-colors"
    >
      Refresh
    </button>
  );
}
