"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { QueueItem } from "@/lib/api";

// ─── helpers ──────────────────────────────────────────────────────────────────

function ageHours(iso: string) {
  return (Date.now() - new Date(iso).getTime()) / 3_600_000;
}

function elapsed(iso: string) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60)    return `${secs}s`;
  if (secs < 3600)  return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  return `${Math.floor(secs / 86400)}d`;
}

function fmtGBP(pence: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}

const LEVEL = {
  critical: { chip: "bg-red-100 text-red-700",     dot: "bg-red-500",     label: "Critical" },
  high:     { chip: "bg-orange-100 text-orange-700", dot: "bg-orange-400",  label: "High"     },
  medium:   { chip: "bg-amber-100 text-amber-700",  dot: "bg-amber-400",   label: "Medium"   },
  low:      { chip: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-400", label: "Low"    },
} as const;

type RiskKey = keyof typeof LEVEL;

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

// ─── card ─────────────────────────────────────────────────────────────────────

function KanbanCard({ item, isSla }: { item: QueueItem; isSla: boolean }) {
  const router = useRouter();
  const hours  = ageHours(item.created_at);
  const ageCol = hours > 8 ? "text-red-500" : hours > 2 ? "text-amber-500" : "text-zinc-400";

  return (
    <div
      onClick={() => router.push(`/investigation/${item.id}`)}
      className="bg-white border border-zinc-200 rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-[13px] font-medium text-zinc-800 leading-snug">
          {item.fraud_type ?? <span className="text-zinc-400 font-normal italic">Unclassified</span>}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {item.vulnerability_flag && (
            <span className="text-[10px] font-semibold text-amber-600">⚠</span>
          )}
          {isSla && (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wide text-red-500">
              <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />
              SLA
            </span>
          )}
        </div>
      </div>

      <div className="text-[17px] font-semibold text-zinc-900 tabular-nums mb-3">
        {fmtGBP(item.amount_pence)}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono text-zinc-400 truncate max-w-[100px]">
          {item.customer_id}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[11px] font-medium ${ACTION_COLOR[item.recommended_action] ?? "text-zinc-500"}`}>
            {ACTION_LABEL[item.recommended_action] ?? item.recommended_action}
          </span>
          <span className={`text-[11px] font-mono ${ageCol}`}>{elapsed(item.created_at)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── column ───────────────────────────────────────────────────────────────────

function KanbanColumn({
  level,
  items,
  slaSet,
}: {
  level: RiskKey;
  items: QueueItem[];
  slaSet: Set<string>;
}) {
  const s = LEVEL[level];

  return (
    <div className="flex-1 min-w-[220px] flex flex-col">
      {/* header */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold ${s.chip}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
          {s.label}
        </span>
        <span className="text-[12px] text-zinc-400 font-mono">{items.length}</span>
      </div>

      {/* cards */}
      <div className="flex-1 overflow-y-auto space-y-2 pb-4 bg-zinc-50/60 rounded-lg p-2">
        {items.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-[12px] text-zinc-400">No cases</p>
          </div>
        ) : (
          items.map(item => (
            <KanbanCard key={item.id} item={item} isSla={slaSet.has(item.id)} />
          ))
        )}
      </div>
    </div>
  );
}

// ─── main ─────────────────────────────────────────────────────────────────────

export default function QueueFilter({ items }: { items: QueueItem[] }) {
  const { grouped, slaSet } = useMemo(() => {
    const slaSet = new Set(
      items.filter(c => ageHours(c.created_at) > 8).map(c => c.id)
    );

    const grouped: Record<string, QueueItem[]> = {
      critical: [], high: [], medium: [], low: [],
    };

    for (const item of items) {
      (grouped[item.risk_level] ?? grouped.low).push(item);
    }

    for (const level of Object.keys(grouped)) {
      grouped[level].sort((a, b) => {
        const aSla = slaSet.has(a.id) ? 0 : 1;
        const bSla = slaSet.has(b.id) ? 0 : 1;
        if (aSla !== bSla) return aSla - bSla;
        return b.risk_score - a.risk_score;
      });
    }

    return { grouped, slaSet };
  }, [items]);

  return (
    <div className="flex gap-3 h-[calc(100vh-140px)] overflow-x-auto pb-2">
      {(["critical", "high", "medium", "low"] as const).map(level => (
        <KanbanColumn
          key={level}
          level={level}
          items={grouped[level]}
          slaSet={slaSet}
        />
      ))}
    </div>
  );
}
