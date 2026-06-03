import Link from "next/link";
import { fetchAuditLog, AuditEntry } from "@/lib/api";
import ExportButton from "./ExportButton";
import PageHeader from "@/components/PageHeader";
import { AnimatedTbody, AnimatedTr } from "@/components/AnimatedRows";

const ACTION_LABEL: Record<string, string> = {
  hold:                 "Hold",
  approve:              "Approve",
  escalate:             "Escalate",
  freeze_account:       "Freeze",
  step_up_verification: "Step-up",
};

const ACTION_COLOR: Record<string, string> = {
  approve:              "text-emerald-600",
  hold:                 "text-orange-600",
  freeze_account:       "text-red-600",
  escalate:             "text-amber-600",
  step_up_verification: "text-blue-600",
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
      <PageHeader
        title="Audit Trail"
        description="Every decision made by analysts, with full AI context"
        actions={!error && log.entries.length > 0 ? <ExportButton entries={log.entries} /> : undefined}
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-600 px-4 py-3 text-[12px] mb-4">
          {error}
        </div>
      )}

      {!error && (
        <>
          {/* Stats strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-5 mb-10">
            <div>
              <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-1.5">Total decisions</div>
              <div className="text-[24px] font-semibold text-zinc-900 tabular-nums leading-none">{log.total}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-1.5">AI overrides</div>
              <div className="flex items-end gap-2">
                <span className={`text-[24px] font-semibold tabular-nums leading-none ${log.overrides > 0 ? "text-amber-600" : "text-zinc-900"}`}>
                  {log.overrides}
                </span>
                {log.total > 0 && (
                  <span className="text-[13px] text-zinc-600 mb-0.5">{overridePct}%</span>
                )}
              </div>
            </div>
            {Object.entries(actionCounts)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 2)
              .map(([action, count]) => (
                <div key={action}>
                  <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-1.5">
                    {ACTION_LABEL[action] ?? action}
                  </div>
                  <div className={`text-[24px] font-semibold tabular-nums leading-none ${ACTION_COLOR[action] ?? "text-zinc-900"}`}>
                    {count}
                  </div>
                </div>
              ))}
          </div>

          {log.entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <div className="w-10 h-10 rounded-full bg-zinc-50 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-600">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <div className="text-center">
              <p className="text-zinc-400 text-[13px] font-medium">No decisions yet</p>
              <p className="text-zinc-600 text-[12px] mt-1">
                Decided cases will appear here with full audit context
              </p>
              </div>
            </div>
          ) : (
            <div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-200">
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
                        className="text-left px-4 py-2 text-[10px] font-medium text-zinc-600 uppercase tracking-widest"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <AnimatedTbody>
                  {log.entries.map((entry, i) => {
                    const isOverride = entry.action !== entry.ai_recommended_action;
                    return (
                      <AnimatedTr
                        key={entry.decision_id}
                        className={`relative transition-colors hover:bg-zinc-50 cursor-pointer ${
                          i > 0 ? "border-t border-zinc-100" : ""
                        }`}
                      >
                        <td className="px-4 py-3 text-[12px] font-mono text-zinc-400 whitespace-nowrap">
                          {formatDate(entry.decided_at)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-[13px] font-mono text-zinc-700">
                            {entry.customer_id}
                          </div>
                          {entry.customer_email && (
                            <div className="text-[12px] text-zinc-500 mt-0.5">
                              {entry.customer_email}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[14px] font-mono font-semibold text-zinc-900 tabular-nums whitespace-nowrap">
                          {formatGBP(entry.amount_pence)}
                        </td>
                        <td className="px-4 py-3 text-[13px] text-zinc-700 max-w-[160px] truncate">
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
                        <td className="px-4 py-3 text-[13px] font-mono text-zinc-400">
                          {entry.analyst_id}
                        </td>
                        <td className="px-4 py-3 text-[13px] font-mono text-zinc-400">
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
                            className="text-[12px] text-zinc-600 group-hover:text-zinc-700 font-medium transition-colors after:absolute after:inset-0 after:content-['']"
                          >
                            View →
                          </Link>
                        </td>
                      </AnimatedTr>
                    );
                  })}
                </AnimatedTbody>
              </table>
            </div>

          )}
        </>
      )}
    </div>
  );
}
