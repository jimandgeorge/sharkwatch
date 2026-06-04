import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchInvestigation, Investigation, RiskFactor } from "@/lib/api";
import DecisionForm from "./DecisionForm";
import ChatPanel from "./ChatPanel";
import NetworkPanel from "./NetworkPanel";
import { AnimatedPanel, AnimatedVulnerabilityBanner } from "./AnimatedLayout";
import CaseTimer from "./CaseTimer";
import PSRPackButton from "./PSRPackButton";

function entityHref(type: string, value: string, invId: string) {
  return `/entity?type=${type}&value=${encodeURIComponent(value)}&from=${invId}`;
}

const RISK: Record<string, { dot: string; text: string; chip: string; bar: string }> = {
  critical: { dot: "bg-red-500",    text: "text-red-700",     chip: "bg-red-100 text-red-700",     bar: "bg-red-500"    },
  high:     { dot: "bg-orange-400", text: "text-orange-700",  chip: "bg-orange-100 text-orange-700", bar: "bg-orange-400" },
  medium:   { dot: "bg-amber-400",  text: "text-amber-700",   chip: "bg-amber-100 text-amber-700",  bar: "bg-amber-400"  },
  low:      { dot: "bg-emerald-400", text: "text-emerald-700", chip: "bg-emerald-100 text-emerald-700", bar: "bg-emerald-400" },
};

function formatGBP(pence: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}

function Prop({ label, value }: { label: string; value?: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-3 py-[5px]">
      <span className="text-[11px] text-zinc-400 uppercase tracking-widest shrink-0 pt-px">{label}</span>
      <span className="text-[12px] text-zinc-700 text-right min-w-0 break-words">{value}</span>
    </div>
  );
}

function PropSection({ label }: { label: string }) {
  return (
    <div className="pt-4 pb-0.5">
      <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">{label}</span>
    </div>
  );
}

export default async function InvestigationPage({ params }: { params: { id: string } }) {
  let inv: Investigation;
  try {
    inv = await fetchInvestigation(params.id);
  } catch {
    notFound();
  }

  const risk = RISK[inv.risk_level] ?? RISK.low;

  return (
    <div>

      {/* sticky command bar */}
      <div className="sticky top-0 z-20 -mx-8 px-8 py-3 bg-white/95 backdrop-blur-sm border-b border-zinc-200 mb-6">
        <div className="flex items-center gap-5">

          {/* Left: back · amount · risk */}
          <Link href="/queue" className="text-[12px] text-zinc-400 hover:text-zinc-700 transition-colors shrink-0 flex items-center gap-1">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7.5 9L4.5 6l3-3" />
            </svg>
            Queue
          </Link>

          <span className="h-4 w-px bg-zinc-200 shrink-0" />

          <span className="text-[20px] font-semibold tabular-nums text-zinc-900 tracking-tight leading-none shrink-0">
            {formatGBP(inv.amount_pence)}
          </span>

          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold shrink-0 ${risk.chip}`}>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${risk.dot}`} />
            {inv.risk_level}
          </span>

          {/* Right: contextual meta */}
          <div className="flex items-center gap-4 ml-auto min-w-0">
            {inv.fraud_type && (
              <span className="text-[13px] text-zinc-500 truncate hidden md:block">{inv.fraud_type}</span>
            )}

            <CaseTimer createdAt={inv.created_at} />

            <span className={`text-[11px] font-medium shrink-0 ${inv.status === "pending" ? "text-amber-600" : "text-zinc-400"}`}>
              {inv.status}
            </span>

            <span className="text-[11px] text-zinc-300 font-mono shrink-0 hidden lg:block">
              {inv.source} · {inv.external_id}
            </span>
          </div>

        </div>
      </div>

      {/* vulnerability banner */}
      {inv.vulnerability_flag && (
        <AnimatedVulnerabilityBanner>
          <div className="bg-amber-50 border border-amber-200 px-4 py-2.5 mb-6 rounded-lg">
            <div className="flex items-center gap-2">
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <path d="M7 1L13 12H1L7 1Z" stroke="#D97706" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M7 5.5V8" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="7" cy="10" r="0.75" fill="#D97706"/>
              </svg>
              <span className="text-[12px] font-semibold text-amber-700">Vulnerable customer</span>
              <span className="text-[11px] text-amber-500 ml-1">FCA Consumer Duty</span>
            </div>
          </div>
        </AnimatedVulnerabilityBanner>
      )}

      {/* two-column body */}
      <div className="flex gap-8">

        {/* LEFT — working content */}
        <div className="flex-1 min-w-0 space-y-8">

          <AnimatedPanel index={0}>
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">AI Assessment</span>
                <span className="text-[11px] text-zinc-400">{inv.llm_provider} · {inv.llm_model}</span>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {inv.fraud_type && (
                  <span className="text-[12px] text-zinc-600">{inv.fraud_type}</span>
                )}
                <span className={`text-[12px] font-medium ${
                  inv.confidence === "high"    ? "text-emerald-600"
                  : inv.confidence === "medium" ? "text-amber-600"
                  : "text-zinc-500"
                }`}>
                  {inv.confidence} confidence
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-1 bg-zinc-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${risk.bar}`} style={{ width: `${Math.min(inv.risk_score, 100)}%` }} />
                </div>
                <span className="text-[11px] font-mono text-zinc-400 shrink-0">{inv.risk_score}</span>
              </div>

              <p className="text-[14px] text-zinc-700 leading-relaxed whitespace-pre-wrap">
                {inv.summary}
              </p>
            </section>
          </AnimatedPanel>

          {inv.status === "pending" && (
            <AnimatedPanel index={1}>
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">EIGG</span>
                  <span className="text-[11px] text-zinc-400">APP fraud specialist</span>
                </div>
                <ChatPanel investigationId={inv.id} />
              </section>
            </AnimatedPanel>
          )}
          {inv.status !== "pending" && (
            <AnimatedPanel index={1}>
              <ChatPanel investigationId={inv.id} readOnly />
            </AnimatedPanel>
          )}

          <AnimatedPanel index={2}>
            {inv.status === "pending" ? (
              <section className="space-y-3">
                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">Decision</span>
                <DecisionForm
                  transactionId={inv.transaction_id}
                  investigationId={inv.id}
                  recommendedAction={inv.recommended_action}
                />
              </section>
            ) : (
              <div className="space-y-3">
                <PSRPackButton investigationId={inv.id} />
                <p className="text-[12px] text-zinc-500 text-center">
                  Investigation decided.{" "}
                  <Link href="/queue" className="text-[#10B981] hover:text-[#059669] transition-colors">
                    Back to queue
                  </Link>
                </p>
              </div>
            )}
          </AnimatedPanel>

        </div>

        {/* RIGHT — properties panel */}
        <div className="w-[260px] shrink-0">
          <div className="lg:sticky lg:top-[52px]">

            <PropSection label="Details" />
            <Prop label="Customer"    value={<span className="font-mono text-[11px]">{inv.customer_id}</span>} />
            <Prop label="Email"       value={inv.customer_email} />
            <Prop label="Transfer"    value={inv.transfer_type} />
            <Prop label="Beneficiary" value={inv.beneficiary_name} />
            <Prop
              label="Account"
              value={inv.beneficiary_account && (
                <Link href={entityHref("account", inv.beneficiary_account, inv.id)} className="font-mono text-[11px] hover:text-[#10B981] transition-colors break-all">
                  {inv.beneficiary_account}
                </Link>
              )}
            />
            <Prop label="Merchant"    value={inv.merchant_name} />
            <Prop
              label="IP"
              value={inv.ip_address && (
                <Link href={entityHref("ip", inv.ip_address, inv.id)} className="font-mono hover:text-[#10B981] transition-colors">
                  {inv.ip_address}
                </Link>
              )}
            />
            <Prop label="Location"    value={inv.geolocation} />
            <Prop
              label="Device"
              value={inv.device_fingerprint && (
                <Link href={entityHref("device", inv.device_fingerprint, inv.id)} className="font-mono text-[11px] break-all hover:text-[#10B981] transition-colors">
                  {inv.device_fingerprint}
                </Link>
              )}
            />
            <Prop label="Occurred"    value={new Date(inv.occurred_at).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })} />

            {inv.risk_factors.length > 0 && (
              <>
                <PropSection label="Risk signals" />
                <ul className="space-y-2 pt-0.5">
                  {inv.risk_factors.map((f: RiskFactor, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-[11px] font-mono font-semibold text-red-600 shrink-0 w-6 text-right mt-px">+{f.score}</span>
                      <div>
                        <div className="text-[12px] text-zinc-700 leading-snug">{f.label}</div>
                        {f.evidence && <div className="text-[11px] text-zinc-400 mt-0.5 leading-snug">{f.evidence}</div>}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {inv.policy_rules_triggered.length > 0 && (
              <>
                <PropSection label="Policy rules" />
                <ul className="space-y-1 pt-0.5">
                  {inv.policy_rules_triggered.map((rule: string, i: number) => (
                    <li key={i} className="text-[11px] font-mono text-zinc-500">{rule}</li>
                  ))}
                </ul>
              </>
            )}

            <div className="pt-4">
              <NetworkPanel
                investigationId={inv.id}
                deviceFingerprint={inv.device_fingerprint}
                beneficiaryAccount={inv.beneficiary_account}
                ipAddress={inv.ip_address}
              />
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
