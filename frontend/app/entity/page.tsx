import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchEntity, EntityTransaction } from "@/lib/api";

const RISK: Record<string, { dot: string; label: string }> = {
  critical: { dot: "bg-red-500",     label: "text-red-400" },
  high:     { dot: "bg-orange-500",  label: "text-orange-400" },
  medium:   { dot: "bg-yellow-500",  label: "text-yellow-400" },
  low:      { dot: "bg-emerald-500", label: "text-emerald-400" },
};

const ENTITY_LABEL: Record<string, string> = {
  device:   "Device fingerprint",
  account:  "Beneficiary account",
  ip:       "IP address",
  customer: "Customer",
};

const ACTION_LABEL: Record<string, string> = {
  hold:                 "Hold",
  approve:              "Approve",
  escalate:             "Escalate",
  freeze_account:       "Freeze",
  step_up_verification: "Step-up",
};

function formatGBP(pence: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}

function timeAgo(iso: string) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export default async function EntityPage({
  searchParams,
}: {
  searchParams: { type?: string; value?: string; from?: string };
}) {
  const { type, value, from } = searchParams;
  if (!type || !value) notFound();

  let data;
  try {
    data = await fetchEntity(type, value);
  } catch {
    notFound();
  }

  const { transactions, summary } = data;
  const entityLabel = ENTITY_LABEL[type] ?? type;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[12px] text-zinc-600">
        <Link href="/queue" className="hover:text-zinc-300 transition-colors">Queue</Link>
        {from && (
          <>
            <span>/</span>
            <Link href={`/investigation/${from}`} className="hover:text-zinc-300 transition-colors font-mono">
              {from.slice(0, 8)}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="text-zinc-500">{entityLabel}</span>
      </nav>

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] font-medium text-zinc-600 uppercase tracking-widest">
            {entityLabel}
          </span>
        </div>
        <h1 className="text-[18px] font-mono text-zinc-100 break-all">{value}</h1>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Transactions", value: summary.total_transactions },
          {
            label: "Total exposure",
            value: formatGBP(summary.total_exposure_pence),
            highlight: summary.total_exposure_pence > 500000,
          },
          { label: "Unique customers", value: summary.unique_customers },
          {
            label: "Pending",
            value: summary.pending,
            highlight: summary.pending > 0,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-zinc-800 bg-zinc-900/20 px-4 py-3"
          >
            <div className="text-[10px] font-medium text-zinc-600 uppercase tracking-widest mb-1">
              {stat.label}
            </div>
            <div
              className={`text-[20px] font-semibold tabular-nums ${
                stat.highlight ? "text-red-400" : "text-zinc-100"
              }`}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Transaction table */}
      {transactions.length === 0 ? (
        <p className="text-[13px] text-zinc-600">No transactions found for this entity.</p>
      ) : (
        <div className="rounded-lg border border-zinc-800 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/40">
            <h2 className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">
              Linked transactions
            </h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                {["When", "Customer", "Amount", "Risk", "Fraud type", "Outcome", ""].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-2.5 text-[10px] font-medium text-zinc-600 uppercase tracking-widest"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.map((txn: EntityTransaction, i: number) => {
                const r = RISK[txn.risk_level] ?? RISK.low;
                const isDecided = txn.status === "decided";

                return (
                  <tr
                    key={txn.transaction_id}
                    className={`hover:bg-zinc-800/30 transition-colors ${
                      i > 0 ? "border-t border-zinc-800/50" : ""
                    }`}
                  >
                    <td className="px-4 py-3 text-[12px] text-zinc-500 font-mono whitespace-nowrap">
                      {timeAgo(txn.occurred_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[12px] font-mono text-zinc-400">{txn.customer_id}</div>
                      {txn.customer_email && (
                        <div className="text-[11px] text-zinc-600 mt-0.5">{txn.customer_email}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[13px] font-mono font-medium text-zinc-100 tabular-nums whitespace-nowrap">
                      {formatGBP(txn.amount_pence)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${r.dot}`} />
                        <span className={`text-[12px] font-medium ${r.label}`}>{txn.risk_level}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-zinc-400 max-w-[180px] truncate">
                      {txn.fraud_type ?? <span className="text-zinc-700">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {isDecided && txn.decision_action ? (
                        <div>
                          <span className="text-[11px] font-medium text-zinc-300">
                            {ACTION_LABEL[txn.decision_action] ?? txn.decision_action}
                          </span>
                          {txn.analyst_id && (
                            <div className="text-[10px] text-zinc-600 font-mono mt-0.5">
                              {txn.analyst_id}
                            </div>
                          )}
                        </div>
                      ) : txn.status === "pending" ? (
                        <span className="text-[11px] font-medium text-yellow-500">Pending</span>
                      ) : (
                        <span className="text-zinc-700 text-[12px]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right pr-4">
                      {txn.investigation_id && (
                        <Link
                          href={`/investigation/${txn.investigation_id}`}
                          className="text-[12px] text-[#5E6AD2] hover:text-[#8B93E8] font-medium transition-colors"
                        >
                          View →
                        </Link>
                      )}
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
