"use client";

import { AuditEntry } from "@/lib/api";

function formatGBP(pence: number) {
  return (pence / 100).toFixed(2);
}

export default function ExportButton({ entries }: { entries: AuditEntry[] }) {
  function handleExport() {
    const headers = [
      "Decided At",
      "External ID",
      "Customer",
      "Amount (GBP)",
      "Fraud Type",
      "Risk Score",
      "AI Recommendation",
      "Decision",
      "Override",
      "Override Reason",
      "Claim Reference",
      "Analyst",
      "Notes",
    ];

    const rows = entries.map((e) => [
      e.decided_at,
      e.external_id,
      e.customer_id,
      formatGBP(e.amount_pence),
      e.fraud_type ?? "",
      e.risk_score,
      e.ai_recommended_action,
      e.action,
      e.action !== e.ai_recommended_action ? "Yes" : "No",
      e.override_reason ?? "",
      e.claim_reference ?? "",
      e.analyst_id,
      e.analyst_notes ?? "",
    ]);

    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={handleExport}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-zinc-700 text-[12px] text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M6 1v7M3 5l3 3 3-3M1 10h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Export CSV
    </button>
  );
}
