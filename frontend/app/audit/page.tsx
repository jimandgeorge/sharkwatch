import Link from "next/link";
import { fetchAuditLog, AuditEntry } from "@/lib/api";
import ExportButton from "./ExportButton";

const ACTION_LABEL: Record<string, string> = {
  hold:                 "Hold",
  approve:              "Approve",
  escalate:             "Escalate",
  freeze_account:       "Freeze",
  step_up_verification: "Step-up",
};

const ACTION_COLOR: Record<string, string> = {
  approve:              "text-emerald-400",
  hold:                 "text-orange-400",
  freeze_account:       "text-red-400",
  escalate:             "text-yellow-400",
  step_up_verification: "text-blue-400",
};

function formatGBP(pence: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(
    pence / 100
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function ActionCell({ action, aiRec }: { action: string; aiRec: string }) {
  const isOverride = action !== aiRec;
  return (
    <div className="flex flex-col gap-0.5">
      {isOverride && (
        <div className="flex items-center gap-1 text-[11px]">
          <span className="text-zinc-600 line-through">
            {ACTION_LABEL[aiRec] ?? aiRec}
          </span>
        </div>
      )}
      <span className={`text-[12px] font-medium ${ACTION_COLOR[action] ?? "text-zinc-400"}`}>
        {ACTION_LABEL[action] ?? action}
        {isOverride && (
          <span className="ml-1 text-[10px] font-normal text-amber-500 border border-amber-500/30 bg-amber-500/10 rounded px-1 py-px">
            override
          </span>
        )}
      </span>
    </div>
  );
}

export default async function AuditPage() {
  let log = { entries: [] as AuditEntry[], total: 0, overrides: 0 };
  let error: string | null = null;

  try {
    log = await fetchAuditLog();
  } catch {
    error = "Could not reach backend.";
  }

  const overridePct =
    log.total > 0 ? Math.round((log.overrides / log.total) * 100) : 0;

  const actionCounts = log.entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.action] = (acc[e.action] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[15px] font-semibold text-zinc-100">Audit Trail</h1>
          <p className="text-[12px] text-zinc-600 mt-0.5">
            Every decision made by analysts, with full AI context
          </p>
        </div>
        {!error && log.entries.length > 0 && (
          <ExportButton entries={log.entries} />
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-900/40 bg-red-950/20 text-red-400 px-4 py-3 text-[12px] mb-4">
          {error}
        </div>
      )}

      {!error && (
        <>
          {/* Stats strip */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 px-4 py-3">
              <div className="text-[11px] text-zinc-600 uppercase tracking-widest mb-1">
                Total decisions
              </div>
              <div className="text-[22px] font-semibold text-zinc-100 tabular-nums">
                {log.total}
              </div>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 px-4 py-3">
              <div className="text-[11px] text-zinc-600 uppercase tracking-widest mb-1">
                AI overrides
              </div>
              <div className="flex items-end gap-2">
                <span
                  className={`text-[22px] font-semibold tabular-nums ${
                    log.overrides > 0 ? "text-amber-400" : "text-zinc-100"
                  }`}
                >
                  {log.overrides}
                </span>
                {log.total > 0 && (
                  <span className="text-[12px] text-zinc-600 mb-1">
                    {overridePct}%
                  </span>
                )}
              </div>
            </div>
            {Object.entries(actionCounts)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 2)
              .map(([action, count]) => (
                <div
                  key={action}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/30 px-4 py-3"
                >
                  <div className="text-[11px] text-zinc-600 uppercase tracking-widest mb-1">
                    {ACTION_LABEL[action] ?? action}
                  </div>
                  <div
                    className={`text-[22px] font-semibold tabular-nums ${
                      ACTION_COLOR[action] ?? "text-zinc-100"
                    }`}
                  >
                    {count}
                  </div>
                </div>
              ))}
          </div>

          {log.entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-1.5">
              <p className="text-zinc-600 text-[13px]">No decisions yet</p>
              <p className="text-zinc-700 text-[12px]">
                Decided cases will appear here with full audit context
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-zinc-800 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/40">
                    {[
                      "Decided",
                      "Customer",
                      "Amount",
                      "Fraud type",
                      "Risk",
                      "Decision",
                      "Analyst",
                      "Claim ref",
                      "Notes",
                      "",
                    ].map((h) => (
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
                  {log.entries.map((entry, i) => {
                    const isOverride = entry.action !== entry.ai_recommended_action;
                    return (
                      <tr
                        key={entry.decision_id}
                        className={`transition-colors hover:bg-zinc-800/30 ${
                          i > 0 ? "border-t border-zinc-800/50" : ""
                        } ${isOverride ? "bg-amber-500/[0.03]" : ""}`}
                      >
                        <td className="px-4 py-3 text-[11px] font-mono text-zinc-500 whitespace-nowrap">
                          {formatDate(entry.decided_at)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-[12px] font-mono text-zinc-400">
                            {entry.customer_id}
                          </div>
                          {entry.customer_email && (
                            <div className="text-[11px] text-zinc-600 mt-0.5">
                              {entry.customer_email}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[13px] font-mono font-medium text-zinc-100 tabular-nums whitespace-nowrap">
                          {formatGBP(entry.amount_pence)}
                        </td>
                        <td className="px-4 py-3 text-[12px] text-zinc-400 max-w-[160px] truncate">
                          {entry.fraud_type ?? (
                            <span className="text-zinc-700">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[12px] font-mono text-zinc-600">
                          {entry.risk_score}
                        </td>
                        <td className="px-4 py-3">
                          <ActionCell
                            action={entry.action}
                            aiRec={entry.ai_recommended_action}
                          />
                          {isOverride && entry.override_reason && (
                            <div className="text-[11px] text-zinc-600 mt-1 max-w-[180px] truncate">
                              {entry.override_reason}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[12px] font-mono text-zinc-500">
                          {entry.analyst_id}
                        </td>
                        <td className="px-4 py-3 text-[12px] font-mono text-zinc-500">
                          {entry.claim_reference ?? (
                            <span className="text-zinc-800">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[12px] text-zinc-600 max-w-[200px] truncate">
                          {entry.analyst_notes ?? (
                            <span className="text-zinc-800">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right pr-4">
                          <Link
                            href={`/investigation/${entry.investigation_id}`}
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
        </>
      )}
    </div>
  );
}
