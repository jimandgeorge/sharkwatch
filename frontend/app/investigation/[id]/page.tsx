import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchInvestigation, Investigation } from "@/lib/api";
import DecisionForm from "./DecisionForm";

const RISK_BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border border-red-200",
  high:     "bg-orange-100 text-orange-800 border border-orange-200",
  medium:   "bg-yellow-100 text-yellow-800 border border-yellow-200",
  low:      "bg-green-100 text-green-800 border border-green-200",
};

function formatGBP(pence: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(
    pence / 100
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs text-slate-400 uppercase tracking-wide">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800 font-medium">{value}</dd>
    </div>
  );
}

export default async function InvestigationPage({
  params,
}: {
  params: { id: string };
}) {
  let inv: Investigation;
  try {
    inv = await fetchInvestigation(params.id);
  } catch {
    notFound();
  }

  const riskBadge = RISK_BADGE[inv.risk_level] ?? RISK_BADGE.low;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Link href="/queue" className="hover:text-slate-700">
          Queue
        </Link>
        <span>/</span>
        <span className="text-slate-600 font-mono text-xs">{inv.id.slice(0, 8)}…</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tabular-nums">
              {formatGBP(inv.amount_pence)}
            </h1>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${riskBadge}`}>
              {inv.risk_level.toUpperCase()} · {inv.risk_score}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {inv.source} · {inv.external_id} ·{" "}
            {new Date(inv.occurred_at).toLocaleString("en-GB")}
          </p>
        </div>
        <span
          className={`text-xs font-medium px-2.5 py-1 rounded border ${
            inv.status === "pending"
              ? "bg-amber-50 border-amber-200 text-amber-700"
              : "bg-slate-100 border-slate-200 text-slate-500"
          }`}
        >
          {inv.status}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — transaction + risk signals */}
        <div className="lg:col-span-1 space-y-5">

          {/* Transaction details */}
          <section className="bg-white rounded-lg border border-slate-200 p-5">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">
              Transaction
            </h2>
            <dl className="space-y-3">
              <Field label="Customer ID" value={<span className="font-mono">{inv.customer_id}</span>} />
              <Field label="Email" value={inv.customer_email} />
              <Field label="Transfer type" value={inv.transfer_type} />
              <Field label="Beneficiary" value={inv.beneficiary_name} />
              <Field label="Beneficiary account" value={inv.beneficiary_account && <span className="font-mono text-xs">{inv.beneficiary_account}</span>} />
              <Field label="Merchant" value={inv.merchant_name} />
              <Field label="IP address" value={inv.ip_address} />
              <Field label="Geolocation" value={inv.geolocation} />
              <Field label="Device fingerprint" value={inv.device_fingerprint && <span className="font-mono text-xs break-all">{inv.device_fingerprint}</span>} />
            </dl>
          </section>

          {/* Risk factors */}
          {Array.isArray(inv.risk_factors) && inv.risk_factors.length > 0 && (
            <section className="bg-white rounded-lg border border-slate-200 p-5">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">
                Risk Signals
              </h2>
              <ul className="space-y-2.5">
                {inv.risk_factors.map((f, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-0.5 text-xs font-mono font-semibold text-red-600 bg-red-50 border border-red-100 rounded px-1.5 py-0.5 shrink-0">
                      +{f.score}
                    </span>
                    <div>
                      <div className="text-sm font-medium text-slate-700">{f.label}</div>
                      <div className="text-xs text-slate-400">{f.evidence}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Policy rules triggered */}
          {Array.isArray(inv.policy_rules_triggered) && inv.policy_rules_triggered.length > 0 && (
            <section className="bg-white rounded-lg border border-slate-200 p-5">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Policy Rules
              </h2>
              <ul className="space-y-1">
                {inv.policy_rules_triggered.map((rule, i) => (
                  <li key={i} className="text-sm text-slate-600 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                    {rule}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Right columns — AI analysis + decision */}
        <div className="lg:col-span-2 space-y-5">

          {/* AI Assessment */}
          <section className="bg-white rounded-lg border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                AI Assessment
              </h2>
              <span className="text-xs text-slate-400">
                {inv.llm_provider} · {inv.llm_model}
              </span>
            </div>

            <div className="flex gap-3 mb-4">
              {inv.fraud_type && (
                <span className="text-xs font-medium bg-slate-100 border border-slate-200 rounded px-2.5 py-1 text-slate-700">
                  {inv.fraud_type}
                </span>
              )}
              <span
                className={`text-xs font-medium rounded px-2.5 py-1 border ${
                  inv.confidence === "high"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : inv.confidence === "medium"
                    ? "bg-amber-50 border-amber-200 text-amber-700"
                    : "bg-slate-50 border-slate-200 text-slate-500"
                }`}
              >
                {inv.confidence} confidence
              </span>
            </div>

            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
              {inv.summary}
            </p>
          </section>

          {/* Decision form */}
          {inv.status === "pending" ? (
            <section className="bg-white rounded-lg border border-slate-200 p-5">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">
                Decision
              </h2>
              <DecisionForm
                transactionId={inv.transaction_id}
                recommendedAction={inv.recommended_action}
              />
            </section>
          ) : (
            <section className="bg-slate-50 rounded-lg border border-slate-200 p-5 text-sm text-slate-500">
              This investigation has been decided.{" "}
              <Link href="/queue" className="text-blue-600 hover:underline">
                Back to queue
              </Link>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
