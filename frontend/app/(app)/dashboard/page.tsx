import Link from "next/link";
import { fetchQueue, fetchAuditLog, QueueItem, AuditEntry } from "@/lib/api";

function fmtGBP(pence: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}

function elapsed(iso: string) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60)    return `${secs}s`;
  if (secs < 3600)  return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  return `${Math.floor(secs / 86400)}d`;
}

const LEVEL_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const LEVEL = {
  critical: { dot: "bg-red-500",    text: "text-red-700",     label: "Critical" },
  high:     { dot: "bg-orange-400", text: "text-orange-700",  label: "High"     },
  medium:   { dot: "bg-amber-400",  text: "text-amber-700",   label: "Medium"   },
  low:      { dot: "bg-emerald-400", text: "text-emerald-700", label: "Low"     },
} as const;

const ACTION_LABEL: Record<string, string> = {
  hold: "Hold", approve: "Approve", escalate: "Escalate",
  freeze_account: "Freeze", step_up_verification: "Step-up",
};

const ACTION_COLOR: Record<string, string> = {
  hold: "text-amber-600", approve: "text-emerald-600", escalate: "text-orange-600",
  freeze_account: "text-red-600", step_up_verification: "text-blue-600",
};

function IssueRow({ item, isSla }: { item: QueueItem; isSla: boolean }) {
  const hours  = (Date.now() - new Date(item.created_at).getTime()) / 3_600_000;
  const r      = LEVEL[item.risk_level as keyof typeof LEVEL] ?? LEVEL.low;
  const ageCol = hours > 8 ? "text-red-600" : hours > 2 ? "text-amber-600" : "text-zinc-400";

  return (
    <Link
      href={`/investigation/${item.id}`}
      className="flex items-center gap-3 px-3 py-[9px] hover:bg-zinc-50 rounded-sm transition-colors"
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${r.dot}`} />
      <span className="w-[92px] shrink-0 text-[13px] font-mono font-semibold text-zinc-900 tabular-nums">{fmtGBP(item.amount_pence)}</span>
      <span className="flex-1 min-w-0 text-[13px] text-zinc-600 truncate">
        {item.fraud_type ?? <span className="text-zinc-400 italic">Unclassified</span>}
      </span>
      <span className="w-[100px] shrink-0 text-[12px] font-mono text-zinc-400 truncate hidden md:block">{item.customer_id}</span>
      <div className="flex items-center gap-2 shrink-0">
        {item.vulnerability_flag && <span className="text-[11px] text-amber-500">⚠</span>}
        {isSla && <span className="flex items-center gap-1 text-[10px] font-semibold text-red-600"><span className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />SLA</span>}
      </div>
      <span className={`w-[54px] shrink-0 text-right text-[12px] font-medium ${ACTION_COLOR[item.recommended_action] ?? "text-zinc-500"}`}>
        {ACTION_LABEL[item.recommended_action] ?? item.recommended_action}
      </span>
      <span className={`w-[38px] shrink-0 text-right text-[11px] font-mono tabular-nums ${ageCol}`}>{elapsed(item.created_at)}</span>
    </Link>
  );
}

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let pending:  QueueItem[]  = [];
  let entries:  AuditEntry[] = [];

  await Promise.allSettled([
    fetchQueue("pending").then(d => { pending = d; }),
    fetchAuditLog().then(d       => { entries = d.entries; }),
  ]);

  const now = Date.now();
  const totalExposurePence = pending.reduce((s, c) => s + c.amount_pence, 0);
  const slaSet = new Set(pending.filter(c => now - new Date(c.created_at).getTime() > 8 * 3_600_000).map(c => c.id));
  const vulnerableCount = pending.filter(c => c.vulnerability_flag).length;

  const priorityCases = pending
    .filter(c => c.risk_level === "critical" || slaSet.has(c.id))
    .sort((a, b) => {
      const ao = LEVEL_ORDER[a.risk_level] ?? 4, bo = LEVEL_ORDER[b.risk_level] ?? 4;
      if (ao !== bo) return ao - bo;
      return b.risk_score - a.risk_score;
    })
    .slice(0, 10);

  const today      = new Date().toISOString().slice(0, 10);
  const todayAudit = entries.filter(e => e.decided_at.slice(0, 10) === today);
  const todayOver  = todayAudit.filter(e => e.action !== e.ai_recommended_action).length;
  const isEmpty    = pending.length === 0 && todayAudit.length === 0;

  return (
    <div className="space-y-8 max-w-4xl">

      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[18px] font-semibold text-zinc-900 tracking-tight">Overview</h1>
          {pending.length > 0 && (
            <p className="text-[13px] text-zinc-500 mt-1">
              {pending.length} pending · {fmtGBP(totalExposurePence)} at risk
            </p>
          )}
        </div>
        <Link href="/queue" className="text-[12px] text-zinc-500 hover:text-zinc-700 transition-colors shrink-0">
          Open queue →
        </Link>
      </div>

      {(pending.length > 0 || todayAudit.length > 0) && (
        <div className="flex items-center gap-10 flex-wrap">
          <div>
            <div className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest mb-1">SLA breach</div>
            <div className={`text-[22px] font-semibold tabular-nums leading-none ${slaSet.size > 0 ? "text-red-600" : "text-zinc-400"}`}>{slaSet.size}</div>
          </div>
          <div>
            <div className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest mb-1">Vulnerable</div>
            <div className={`text-[22px] font-semibold tabular-nums leading-none ${vulnerableCount > 0 ? "text-amber-600" : "text-zinc-400"}`}>{vulnerableCount}</div>
          </div>
          {todayAudit.length > 0 && (
            <div>
              <div className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest mb-1">Decided today</div>
              <div className="text-[22px] font-semibold tabular-nums leading-none text-zinc-700">{todayAudit.length}</div>
            </div>
          )}
          {todayAudit.length > 0 && todayOver > 0 && (
            <div>
              <div className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest mb-1">Override rate</div>
              <div className="text-[22px] font-semibold tabular-nums leading-none text-amber-600">{Math.round((todayOver / todayAudit.length) * 100)}%</div>
            </div>
          )}
        </div>
      )}

      {priorityCases.length > 0 && (
        <section className="space-y-1">
          <div className="flex items-center justify-between px-3 mb-1">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Needs attention</span>
              <span className="text-[11px] font-mono text-zinc-400">{priorityCases.length}</span>
            </div>
            <Link href="/queue" className="text-[11px] text-zinc-400 hover:text-zinc-700 transition-colors">All →</Link>
          </div>
          {priorityCases.map(c => (
            <IssueRow key={c.id} item={c} isSla={slaSet.has(c.id)} />
          ))}
        </section>
      )}

      {pending.length > priorityCases.length && (
        <section className="space-y-1">
          <div className="px-3 mb-1">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">Remaining</span>
            <span className="text-[11px] font-mono text-zinc-400 ml-2">{pending.length - priorityCases.length}</span>
          </div>
          {pending
            .filter(c => !priorityCases.find(p => p.id === c.id))
            .sort((a, b) => (LEVEL_ORDER[a.risk_level] ?? 4) - (LEVEL_ORDER[b.risk_level] ?? 4) || b.risk_score - a.risk_score)
            .slice(0, 8)
            .map(c => <IssueRow key={c.id} item={c} isSla={false} />)}
          {pending.length - priorityCases.length > 8 && (
            <div className="px-3 py-2">
              <Link href="/queue" className="text-[12px] text-zinc-500 hover:text-zinc-700 transition-colors">
                + {pending.length - priorityCases.length - 8} more →
              </Link>
            </div>
          )}
        </section>
      )}

      {isEmpty && (
        <div className="py-16">
          <p className="text-zinc-700 text-[14px] font-medium">Queue is clear</p>
          <p className="text-zinc-400 text-[13px] mt-1">Cases appear here when your fraud engine flags transactions.</p>
          <Link href="/integrate" className="text-[13px] text-[#10B981] hover:text-[#059669] transition-colors mt-4 inline-block">
            Configure integration →
          </Link>
        </div>
      )}

    </div>
  );
}
