"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { QueueItem } from "@/lib/api";

function fmtGBP(pence: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}

function timeAgo(iso: string) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60)    return `${secs}s`;
  if (secs < 3600)  return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  return `${Math.floor(secs / 86400)}d`;
}

const LEVEL: Record<string, { dot: string; text: string }> = {
  critical: { dot: "bg-red-500",    text: "text-red-600"     },
  high:     { dot: "bg-orange-400", text: "text-orange-600"  },
  medium:   { dot: "bg-amber-400",  text: "text-amber-600"   },
  low:      { dot: "bg-emerald-400", text: "text-emerald-600" },
};

const ACTION_LABEL: Record<string, string> = {
  hold: "Hold", approve: "Approve", escalate: "Escalate",
  freeze_account: "Freeze", step_up_verification: "Step-up",
};

const ACTION_COLOR: Record<string, string> = {
  hold:                 "text-orange-600",
  approve:              "text-emerald-600",
  escalate:             "text-amber-600",
  freeze_account:       "text-red-600",
  step_up_verification: "text-blue-600",
};

export default function HistoryTable({ items }: { items: QueueItem[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(c =>
      c.customer_id.toLowerCase().includes(q) ||
      (c.customer_email ?? "").toLowerCase().includes(q) ||
      (c.fraud_type ?? "").toLowerCase().includes(q) ||
      (c.analyst_id ?? "").toLowerCase().includes(q)
    );
  }, [items, search]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <span className="text-[12px] text-zinc-400 font-mono">{filtered.length} of {items.length}</span>
        <div className="relative">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search…"
            className="bg-white border border-zinc-200 rounded-lg pl-7 pr-3 py-1.5 text-[13px] text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 w-56 transition-colors"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-zinc-500 text-[13px]">No results for &ldquo;{search}&rdquo;</p>
          <button onClick={() => setSearch("")} className="text-[12px] text-zinc-400 hover:text-zinc-600 transition-colors mt-1 block mx-auto">Clear</button>
        </div>
      ) : (
        <div>
          {filtered.map(item => {
            const r = LEVEL[item.risk_level] ?? LEVEL.low;
            return (
              <Link
                key={item.id}
                href={`/investigation/${item.id}`}
                className="flex items-center gap-3 px-3 py-[9px] hover:bg-zinc-50 rounded-sm transition-colors group"
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${r.dot}`} />
                <span className="w-[92px] shrink-0 text-[13px] font-mono font-semibold text-zinc-900 tabular-nums">
                  {fmtGBP(item.amount_pence)}
                </span>
                <span className="flex-1 min-w-0 text-[13px] text-zinc-600 truncate">
                  {item.fraud_type ?? <span className="text-zinc-400 italic">Unclassified</span>}
                </span>
                <span className="w-[100px] shrink-0 text-[12px] font-mono text-zinc-400 truncate hidden md:block">
                  {item.customer_id}
                </span>
                {item.decision_action ? (
                  <span className={`w-[54px] shrink-0 text-right text-[12px] font-medium ${ACTION_COLOR[item.decision_action] ?? "text-zinc-500"}`}>
                    {ACTION_LABEL[item.decision_action] ?? item.decision_action}
                  </span>
                ) : (
                  <span className="w-[54px] shrink-0 text-right text-[12px] text-zinc-300">—</span>
                )}
                <span className="w-[72px] shrink-0 text-right text-[11px] font-mono text-zinc-400 truncate hidden lg:block">
                  {item.analyst_id ?? "—"}
                </span>
                <span className="w-[38px] shrink-0 text-right text-[11px] font-mono text-zinc-400">
                  {item.decided_at ? timeAgo(item.decided_at) : "—"}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
