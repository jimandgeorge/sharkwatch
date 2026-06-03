"use client";

import { useState, useEffect } from "react";

function elapsed(from: string) {
  const ms   = Date.now() - new Date(from).getTime();
  const mins = Math.floor(ms / 60000);
  const hrs  = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0)  return `${days}d ${hrs % 24}h`;
  if (hrs > 0)   return `${hrs}h ${mins % 60}m`;
  return `${mins}m`;
}

export default function CaseTimer({ createdAt }: { createdAt: string }) {
  const [label, setLabel] = useState(elapsed(createdAt));

  useEffect(() => {
    const id = setInterval(() => setLabel(elapsed(createdAt)), 60_000);
    return () => clearInterval(id);
  }, [createdAt]);

  const hours   = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  const isSla   = hours > 8;
  const isWarn  = hours > 2;

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[12px] font-mono tabular-nums ${
        isSla  ? "text-red-600"   :
        isWarn ? "text-amber-600" :
                 "text-zinc-500"
      }`}
      title="Time since case was flagged"
    >
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="shrink-0">
        <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M6 3.5V6l2 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
      {label}
      {isSla && <span className="text-[10px] font-sans font-medium">SLA</span>}
    </span>
  );
}
