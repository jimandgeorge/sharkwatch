"use client";

import { useState } from "react";

export default function PSRPackButton({ investigationId }: { investigationId: string }) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    setError(false);
    try {
      const res = await fetch(`/api/psr-pack?id=${investigationId}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `psr-${investigationId.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError(true);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleDownload}
        disabled={downloading}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-[#10B981] hover:bg-[#0CA678] disabled:opacity-50 text-white text-[13px] font-medium transition-colors"
      >
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <path d="M2 10h9M6.5 1v7M4 5.5l2.5 2.5 2.5-2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {downloading ? "Generating…" : "Download PSR Claim Pack"}
      </button>
      {error && (
        <p className="text-[11px] text-red-400 mt-1.5 text-center">Generation failed — check backend logs.</p>
      )}
    </div>
  );
}
