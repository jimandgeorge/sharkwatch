import Link from "next/link";
import { fetchQueue, QueueItem } from "@/lib/api";
import AutoRefresh from "./AutoRefresh";

const RISK: Record<string, { dot: string; label: string; action: string }> = {
  critical: { dot: "bg-red-500",     label: "text-red-400",     action: "bg-red-500/10 text-red-400 border-red-500/20" },
  high:     { dot: "bg-orange-500",  label: "text-orange-400",  action: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  medium:   { dot: "bg-yellow-500",  label: "text-yellow-400",  action: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  low:      { dot: "bg-emerald-500", label: "text-emerald-400", action: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
};

const ACTION_LABEL: Record<string, string> = {
  hold:                 "Hold",
  approve:              "Approve",
  escalate:             "Escalate",
  freeze_account:       "Freeze",
  step_up_verification: "Step-up",
};

function formatGBP(pence: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(
    pence / 100
  );
}

function timeAgo(iso: string) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  return `${Math.floor(secs / 86400)}d`;
}

function SlaAge({ iso }: { iso: string }) {
  const hours = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  const label = timeAgo(iso);
  if (hours > 8)
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-mono text-red-400">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
        {label}
      </span>
    );
  if (hours > 2)
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-400">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
        {label}
      </span>
    );
  return <span className="text-[12px] text-zinc-600 font-mono">{label}</span>;
}

export default async function QueuePage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const status = searchParams.status === "decided" ? "decided" : "pending";
  let items: QueueItem[] = [];
  let error: string | null = null;

  try {
    items = await fetchQueue(status);
  } catch {
    error = "Could not reach backend.";
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 border border-zinc-800 rounded-lg p-0.5">
            <Link
              href="/queue"
              className={`px-3 py-1 rounded-md text-[12px] font-medium transition-colors ${
                status === "pending"
                  ? "bg-zinc-800 text-zinc-200"
                  : "text-zinc-600 hover:text-zinc-400"
              }`}
            >
              Pending
              {status === "pending" && items.length > 0 && (
                <span className="ml-1.5 text-[11px] text-zinc-500 font-mono">{items.length}</span>
              )}
            </Link>
            <Link
              href="/queue?status=decided"
              className={`px-3 py-1 rounded-md text-[12px] font-medium transition-colors ${
                status === "decided"
                  ? "bg-zinc-800 text-zinc-200"
                  : "text-zinc-600 hover:text-zinc-400"
              }`}
            >
              History
              {status === "decided" && items.length > 0 && (
                <span className="ml-1.5 text-[11px] text-zinc-500 font-mono">{items.length}</span>
              )}
            </Link>
          </div>
        </div>
        {status === "pending" && <AutoRefresh />}
      </div>

      {error && (
        <div className="rounded-lg border border-red-900/40 bg-red-950/20 text-red-400 px-4 py-3 text-[12px] mb-4">
          {error}
        </div>
      )}

      {!error && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-1.5">
          <p className="text-zinc-600 text-[13px]">
            {status === "pending" ? "No pending investigations" : "No decided cases yet"}
          </p>
          <p className="text-zinc-700 text-[12px]">
            {status === "pending"
              ? "Cases appear here after transactions are flagged"
              : "Decided cases will appear here"}
          </p>
        </div>
      )}

      {items.length > 0 && status === "pending" && (
        <div className="rounded-lg border border-zinc-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/40">
                {["Risk", "Amount", "Customer", "Fraud type", "Action", "Confidence", "Age", ""].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-2.5 text-[10px] font-medium text-zinc-600 uppercase tracking-widest"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const r = RISK[item.risk_level] ?? RISK.low;
                return (
                  <tr
                    key={item.id}
                    className={`group transition-colors hover:bg-zinc-800/30 ${
                      i > 0 ? "border-t border-zinc-800/50" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${r.dot}`} />
                        <span className={`text-[12px] font-medium ${r.label}`}>
                          {item.risk_level}
                        </span>
                        <span className="text-[11px] font-mono text-zinc-600">
                          {item.risk_score}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[13px] font-mono font-medium text-zinc-100 tabular-nums">
                      {formatGBP(item.amount_pence)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[12px] font-mono text-zinc-400">{item.customer_id}</div>
                      {item.customer_email && (
                        <div className="text-[11px] text-zinc-600 mt-0.5">{item.customer_email}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <div className="text-[12px] text-zinc-400 truncate">
                        {item.fraud_type ?? <span className="text-zinc-700">—</span>}
                      </div>
                      {item.vulnerability_flag && (
                        <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] font-medium text-amber-400 border border-amber-500/20 bg-amber-500/10 rounded px-1.5 py-px">
                          vulnerable
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium ${r.action}`}
                      >
                        {ACTION_LABEL[item.recommended_action] ?? item.recommended_action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[12px]">
                      <span
                        className={
                          item.confidence === "high"
                            ? "text-emerald-400"
                            : item.confidence === "medium"
                            ? "text-yellow-400"
                            : "text-zinc-600"
                        }
                      >
                        {item.confidence}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <SlaAge iso={item.created_at} />
                    </td>
                    <td className="px-4 py-3 text-right pr-4">
                      <Link
                        href={`/investigation/${item.id}`}
                        className="text-[12px] text-[#5E6AD2] hover:text-[#8B93E8] font-medium transition-colors"
                      >
                        Review →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {items.length > 0 && status === "decided" && (
        <div className="rounded-lg border border-zinc-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/40">
                {["Amount", "Customer", "Fraud type", "Decision", "Analyst", "Decided", ""].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-2.5 text-[10px] font-medium text-zinc-600 uppercase tracking-widest"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const r = RISK[item.risk_level] ?? RISK.low;
                return (
                  <tr
                    key={item.id}
                    className={`group transition-colors hover:bg-zinc-800/30 ${
                      i > 0 ? "border-t border-zinc-800/50" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="text-[13px] font-mono font-medium text-zinc-100 tabular-nums">
                        {formatGBP(item.amount_pence)}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`w-1 h-1 rounded-full shrink-0 ${r.dot}`} />
                        <span className={`text-[11px] ${r.label}`}>{item.risk_level}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[12px] font-mono text-zinc-400">{item.customer_id}</div>
                      {item.customer_email && (
                        <div className="text-[11px] text-zinc-600 mt-0.5">{item.customer_email}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-zinc-400 max-w-[180px] truncate">
                      {item.fraud_type ?? <span className="text-zinc-700">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {item.decision_action ? (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium ${r.action}`}
                        >
                          {ACTION_LABEL[item.decision_action] ?? item.decision_action}
                        </span>
                      ) : (
                        <span className="text-zinc-700 text-[12px]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[12px] font-mono text-zinc-500">
                      {item.analyst_id ?? <span className="text-zinc-700">—</span>}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-zinc-600 font-mono">
                      {item.decided_at ? timeAgo(item.decided_at) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right pr-4">
                      <Link
                        href={`/investigation/${item.id}`}
                        className="text-[12px] text-zinc-600 hover:text-zinc-300 font-medium transition-colors"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
