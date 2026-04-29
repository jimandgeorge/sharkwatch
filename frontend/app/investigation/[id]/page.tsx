import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchInvestigation, Investigation, RiskFactor } from "@/lib/api";
import DecisionForm from "./DecisionForm";
import ChatPanel from "./ChatPanel";
import NetworkPanel from "./NetworkPanel";

function entityHref(type: string, value: string, invId: string) {
  return `/entity?type=${type}&value=${encodeURIComponent(value)}&from=${invId}`;
}

const RISK: Record<string, { badge: string; dot: string }> = {
  critical: { badge: "bg-red-500/10 text-red-400 border-red-500/20",        dot: "bg-red-500" },
  high:     { badge: "bg-orange-500/10 text-orange-400 border-orange-500/20", dot: "bg-orange-500" },
  medium:   { badge: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", dot: "bg-yellow-500" },
  low:      { badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", dot: "bg-emerald-500" },
};

function formatGBP(pence: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(
    pence / 100
  );
}

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[10px] font-medium text-zinc-600 uppercase tracking-widest">{label}</dt>
      <dd className="text-[12px] text-zinc-300">{value}</dd>
    </div>
  );
}

function Panel({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900/20 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800">
        <h2 className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">{title}</h2>
        {aside && <div className="text-[11px] text-zinc-600">{aside}</div>}
      </div>
      <div className="p-4">{children}</div>
    </section>
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

  const risk = RISK[inv.risk_level] ?? RISK.low;

  return (
    <div className="space-y-5">
      <nav className="flex items-center gap-1.5 text-[12px] text-zinc-600">
        <Link href="/queue" className="hover:text-zinc-300 transition-colors">
          Queue
        </Link>
        <span>/</span>
        <span className="text-zinc-500 font-mono">{inv.id.slice(0, 8)}</span>
      </nav>

      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-[26px] font-semibold tabular-nums text-zinc-50 tracking-tight">
            {formatGBP(inv.amount_pence)}
          </h1>
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[12px] font-medium ${risk.badge}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${risk.dot}`} />
            {inv.risk_level} · {inv.risk_score}
          </span>
          <span
            className={`text-[11px] px-2 py-0.5 rounded border font-medium ${
              inv.status === "pending"
                ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"
                : "bg-zinc-800 border-zinc-700 text-zinc-500"
            }`}
          >
            {inv.status}
          </span>
        </div>
        <p className="text-[12px] text-zinc-600 mt-1.5">
          {inv.source} · {inv.external_id} · {new Date(inv.occurred_at).toLocaleString("en-GB")}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Left sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <Panel title="Transaction">
            <dl className="space-y-3">
              <Field label="Customer" value={<span className="font-mono">{inv.customer_id}</span>} />
              <Field label="Email" value={inv.customer_email} />
              <Field label="Transfer type" value={inv.transfer_type} />
              <Field label="Beneficiary" value={inv.beneficiary_name} />
              <Field
                label="Account"
                value={
                  inv.beneficiary_account && (
                    <Link href={entityHref("account", inv.beneficiary_account, inv.id)} className="font-mono text-[11px] hover:text-[#8B93E8] transition-colors">
                      {inv.beneficiary_account}
                    </Link>
                  )
                }
              />
              <Field label="Merchant" value={inv.merchant_name} />
              <Field
                label="IP address"
                value={
                  inv.ip_address && (
                    <Link href={entityHref("ip", inv.ip_address, inv.id)} className="font-mono hover:text-[#8B93E8] transition-colors">
                      {inv.ip_address}
                    </Link>
                  )
                }
              />
              <Field label="Geolocation" value={inv.geolocation} />
              <Field
                label="Device"
                value={
                  inv.device_fingerprint && (
                    <Link href={entityHref("device", inv.device_fingerprint, inv.id)} className="font-mono text-[11px] break-all hover:text-[#8B93E8] transition-colors">
                      {inv.device_fingerprint}
                    </Link>
                  )
                }
              />
            </dl>
          </Panel>

          {inv.risk_factors.length > 0 && (
            <Panel title="Risk signals">
              <ul className="space-y-3">
                {inv.risk_factors.map((f: RiskFactor, i: number) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-px text-[11px] font-mono font-semibold text-red-400 bg-red-500/10 border border-red-500/20 rounded px-1.5 py-px shrink-0">
                      +{f.score}
                    </span>
                    <div>
                      <div className="text-[12px] font-medium text-zinc-300">{f.label}</div>
                      <div className="text-[11px] text-zinc-600 mt-0.5">{f.evidence}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {inv.policy_rules_triggered.length > 0 && (
            <Panel title="Policy rules">
              <ul className="space-y-2">
                {inv.policy_rules_triggered.map((rule: string, i: number) => (
                  <li key={i} className="flex items-center gap-2 text-[12px] text-zinc-400">
                    <span className="w-1 h-1 rounded-full bg-zinc-600 shrink-0" />
                    {rule}
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <NetworkPanel
            investigationId={inv.id}
            deviceFingerprint={inv.device_fingerprint}
            beneficiaryAccount={inv.beneficiary_account}
            ipAddress={inv.ip_address}
          />
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-4">

          {/* 1. What the AI found */}
          <Panel
            title="AI Assessment"
            aside={<>{inv.llm_provider} · {inv.llm_model}</>}
          >
            <div className="flex flex-wrap gap-2 mb-3">
              {inv.fraud_type && (
                <span className="text-[11px] font-medium bg-zinc-800 border border-zinc-700 rounded-full px-2.5 py-0.5 text-zinc-300">
                  {inv.fraud_type}
                </span>
              )}
              <span
                className={`text-[11px] font-medium rounded-full px-2.5 py-0.5 border ${
                  inv.confidence === "high"
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    : inv.confidence === "medium"
                    ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"
                    : "bg-zinc-800 border-zinc-700 text-zinc-500"
                }`}
              >
                {inv.confidence} confidence
              </span>
            </div>
            <p className="text-[13px] text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {inv.summary}
            </p>
          </Panel>

          {/* 2. Dig deeper */}
          <section className="rounded-lg border border-zinc-800 bg-zinc-900/20 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#5E6AD2]" />
                <h2 className="text-[10px] font-medium text-zinc-300 uppercase tracking-widest">
                  Shark Watch
                </h2>
              </div>
              <span className="text-[11px] text-zinc-600">APP fraud specialist</span>
            </div>
            <div className="p-4">
              <ChatPanel investigationId={inv.id} />
            </div>
          </section>

          {/* 3. Decide */}
          {inv.status === "pending" ? (
            <Panel title="Decision">
              <DecisionForm
                transactionId={inv.transaction_id}
                recommendedAction={inv.recommended_action}
              />
            </Panel>
          ) : (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/20 px-5 py-4 text-[12px] text-zinc-600">
              Investigation decided.{" "}
              <Link href="/queue" className="text-[#5E6AD2] hover:text-[#8B93E8] transition-colors">
                Back to queue
              </Link>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
