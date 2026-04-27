import Link from "next/link";
import { fetchQueue, QueueItem } from "@/lib/api";

const RISK_BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border border-red-200",
  high:     "bg-orange-100 text-orange-700 border border-orange-200",
  medium:   "bg-yellow-100 text-yellow-700 border border-yellow-200",
  low:      "bg-green-100 text-green-700 border border-green-200",
};

const ACTION_LABEL: Record<string, string> = {
  hold:                 "Hold",
  approve:              "Approve",
  escalate:             "Escalate",
  freeze_account:       "Freeze",
  step_up_verification: "Step-up",
};

function formatGBP(pence: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pence / 100);
}

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export default async function QueuePage() {
  let items: QueueItem[] = [];
  let error: string | null = null;

  try {
    items = await fetchQueue("pending");
  } catch (e) {
    error = "Could not reach backend — is it running?";
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold">Pending Investigations</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {items.length} case{items.length !== 1 ? "s" : ""} awaiting decision — sorted by risk score
          </p>
        </div>
        <a
          href="/queue"
          className="text-sm text-slate-500 hover:text-slate-700 border border-slate-200 rounded px-3 py-1.5 bg-white"
        >
          Refresh
        </a>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm mb-4">
          {error}
        </div>
      )}

      {!error && items.length === 0 && (
        <div className="text-center py-16 text-slate-400 text-sm">
          No pending investigations. Cases will appear here after transactions are ingested.
        </div>
      )}

      {items.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3 font-medium">Risk</th>
                <th className="text-left px-4 py-3 font-medium">Amount</th>
                <th className="text-left px-4 py-3 font-medium">Customer</th>
                <th className="text-left px-4 py-3 font-medium">Fraud Type</th>
                <th className="text-left px-4 py-3 font-medium">Recommended</th>
                <th className="text-left px-4 py-3 font-medium">Confidence</th>
                <th className="text-left px-4 py-3 font-medium">Received</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-slate-50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${RISK_BADGE[item.risk_level] ?? RISK_BADGE.low}`}
                      >
                        {item.risk_level.toUpperCase()}
                      </span>
                      <span className="font-mono text-slate-700 font-medium">
                        {item.risk_score}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium tabular-nums">
                    {formatGBP(item.amount_pence)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs text-slate-600">{item.customer_id}</div>
                    {item.customer_email && (
                      <div className="text-xs text-slate-400">{item.customer_email}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {item.fraud_type ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium text-slate-700">
                      {ACTION_LABEL[item.recommended_action] ?? item.recommended_action}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs ${
                        item.confidence === "high"
                          ? "text-emerald-600"
                          : item.confidence === "medium"
                          ? "text-amber-600"
                          : "text-slate-400"
                      }`}
                    >
                      {item.confidence}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {timeAgo(item.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/investigation/${item.id}`}
                      className="text-xs font-medium text-blue-600 hover:text-blue-800"
                    >
                      Review &rarr;
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
