"use client";

import { useState, useEffect, useCallback } from "react";
import { CLIENT_BASE } from "@/lib/api";
import type { WebhookConfig, WebhookDelivery } from "@/lib/api";

const BACKEND_BASE = CLIENT_BASE;
const ANALYST_KEY  = "eigg-analyst-id";

const CATEGORIES = [
  { id: "system",     label: "System" },
  { id: "model",      label: "Model" },
  { id: "account",   label: "Account" },
  { id: "webhooks",  label: "Webhooks" },
  { id: "compliance",label: "Compliance" },
] as const;

type Category = typeof CATEGORIES[number]["id"];

// ── Shared primitives ─────────────────────────────────────────────────────────

const inputCls = "w-full bg-white border border-zinc-200 rounded-md px-3 py-2 text-[13px] text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-300 focus:border-zinc-300 transition-colors";

function Row({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-6 py-3 border-b border-zinc-100 last:border-0">
      <span className="text-[13px] text-zinc-500 shrink-0">{label}</span>
      <span className={`text-[13px] text-zinc-800 text-right ${mono ? "font-mono" : "font-medium"}`}>{value}</span>
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`relative h-5 w-9 rounded-full transition-colors duration-200 focus:outline-none ${on ? "bg-emerald-500" : "bg-zinc-300"}`}
    >
      <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${on ? "translate-x-4" : "translate-x-0"}`} />
    </button>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest mb-3">{children}</p>;
}

// ── System ────────────────────────────────────────────────────────────────────

const PROVIDER_LABEL: Record<string, string> = {
  anthropic: "Anthropic (Claude)",
  ollama:    "Ollama (self-hosted)",
  azure:     "Azure OpenAI",
  bedrock:   "AWS Bedrock",
  mock:      "Mock (dev)",
};

function SystemPanel() {
  const [info, setInfo] = useState<Record<string, string> | null>(null);
  const [err, setErr]   = useState(false);

  useEffect(() => {
    fetch(`${BACKEND_BASE}/system`).then(r => r.json()).then(setInfo).catch(() => setErr(true));
  }, []);

  if (err) return <p className="text-[13px] text-red-500">Could not reach backend.</p>;
  if (!info) return <div className="space-y-3 animate-pulse">{[1,2,3,4,5].map(i => <div key={i} className="h-10 bg-zinc-50 rounded border border-zinc-100" />)}</div>;

  return (
    <div>
      <Row label="Version"      value={`v${info.version}`} />
      <Row label="Environment"  value={info.environment} />
      <Row label="LLM provider" value={PROVIDER_LABEL[info.llm_provider] ?? info.llm_provider} />
      <Row label="LLM model"    value={info.llm_model} mono />
      <Row label="Backend URL"  value={BACKEND_BASE} mono />
    </div>
  );
}

// ── Account ───────────────────────────────────────────────────────────────────

function AccountPanel() {
  const [analystId, setAnalystId] = useState("");
  const [cleared, setCleared]     = useState(false);

  useEffect(() => { setAnalystId(localStorage.getItem(ANALYST_KEY) ?? ""); }, []);

  function clear() {
    localStorage.removeItem(ANALYST_KEY);
    setAnalystId(""); setCleared(true);
    setTimeout(() => setCleared(false), 2000);
  }

  return (
    <div className="space-y-6">
      <div>
        <Label>Analyst identity</Label>
        <div className="bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-3">
          {analystId ? (
            <div className="flex items-center justify-between">
              <span className="font-mono text-[13px] text-zinc-800">{analystId}</span>
              <button onClick={clear} className="text-[12px] text-red-500 hover:text-red-700 transition-colors">
                {cleared ? "Cleared" : "Forget"}
              </button>
            </div>
          ) : (
            <p className="text-[13px] text-zinc-400">No ID saved — enter your analyst ID when submitting a decision and it will be remembered here.</p>
          )}
        </div>
      </div>

      <div>
        <Label>SLA thresholds</Label>
        <Row label="Warning (amber)" value="2 hours" />
        <Row label="Breach (red)"    value="8 hours" />
        <Row label="Mule risk"       value="3+ linked transactions" />
        <p className="text-[11px] text-zinc-400 mt-2">Configurable thresholds are planned for a future release.</p>
      </div>
    </div>
  );
}

// ── Webhooks ──────────────────────────────────────────────────────────────────

const EVENT_LABELS: Record<string, { label: string; detail: string }> = {
  "case.created":        { label: "Case created",        detail: "New transaction ingested" },
  "case.investigated":   { label: "Case investigated",   detail: "AI investigation complete" },
  "decision.submitted":  { label: "Decision submitted",  detail: "Analyst submits any decision" },
  "decision.overridden": { label: "Decision overridden", detail: "Analyst overrides AI recommendation" },
  "case.escalated":      { label: "Case escalated",      detail: "Decision action is escalate" },
  "psr_pack.generated":  { label: "PSR pack generated",  detail: "Claim pack PDF downloaded" },
};

function WebhooksPanel() {
  const [url, setUrl]           = useState("");
  const [enabled, setEnabled]   = useState(false);
  const [events, setEvents]     = useState<string[]>([]);
  const [secret, setSecret]     = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [supported, setSupported]   = useState<string[]>(Object.keys(EVENT_LABELS));
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [rotating, setRotating] = useState(false);
  const [err, setErr]           = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [showLog, setShowLog]   = useState(false);
  const [loadingLog, setLoadingLog] = useState(false);

  useEffect(() => {
    fetch(`${BACKEND_BASE}/settings/webhook`)
      .then(r => r.json())
      .then((d: WebhookConfig) => {
        setUrl(d.webhook_url ?? "");
        setEnabled(d.webhook_enabled);
        setEvents(d.webhook_events);
        setSecret(d.webhook_secret);
        if (d.supported_events?.length) setSupported(d.supported_events);
      })
      .catch(() => setErr("Could not load webhook settings."));
  }, []);

  const loadLog = useCallback(async () => {
    setLoadingLog(true);
    try {
      const r = await fetch(`${BACKEND_BASE}/settings/webhook/deliveries`);
      const d = await r.json();
      setDeliveries(d.deliveries ?? []);
    } catch { /* ignore */ } finally { setLoadingLog(false); }
  }, []);

  async function save() {
    setSaving(true); setErr(null);
    try {
      const r = await fetch(`${BACKEND_BASE}/settings/webhook`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhook_url: url || null, webhook_enabled: enabled, webhook_events: events }),
      });
      if (!r.ok) throw new Error();
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch { setErr("Failed to save."); } finally { setSaving(false); }
  }

  async function rotate() {
    setRotating(true); setErr(null);
    try {
      const r = await fetch(`${BACKEND_BASE}/settings/webhook/rotate-secret`, { method: "POST" });
      if (!r.ok) throw new Error();
      const d = await r.json();
      setSecret(d.webhook_secret);
    } catch { setErr("Failed to rotate secret."); } finally { setRotating(false); }
  }

  function toggleEvent(ev: string) {
    setEvents(prev => prev.includes(ev) ? prev.filter(e => e !== ev) : [...prev, ev]);
  }

  return (
    <div className="space-y-6">
      {err && <p className="text-[12px] text-red-500">{err}</p>}

      {/* Enable */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] font-medium text-zinc-800">Enable outbound webhooks</p>
          <p className="text-[12px] text-zinc-400 mt-0.5">POST events to your endpoint when cases are created or decided</p>
        </div>
        <Toggle on={enabled} onChange={setEnabled} />
      </div>

      {/* URL */}
      <div className="space-y-1.5">
        <Label>Endpoint URL</Label>
        <input value={url} onChange={e => setUrl(e.target.value)}
          placeholder="https://your-system.com/webhooks/eigg"
          className={`${inputCls} font-mono`} />
        <p className="text-[11px] text-zinc-400">Must return 2xx within 10 s. Retried 3× with exponential backoff.</p>
      </div>

      {/* Secret */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>Signing secret</Label>
          <div className="flex items-center gap-3 mb-3">
            <button type="button" onClick={() => setShowSecret(s => !s)} className="text-[11px] text-zinc-500 hover:text-zinc-700 transition-colors">{showSecret ? "Hide" : "Show"}</button>
            <button type="button" onClick={rotate} disabled={rotating} className="text-[11px] text-zinc-500 hover:text-zinc-700 disabled:opacity-40 transition-colors">{rotating ? "Rotating…" : "Rotate"}</button>
          </div>
        </div>
        <input readOnly value={showSecret ? secret : "•".repeat(36)}
          className={`${inputCls} font-mono bg-zinc-50 cursor-default`} />
        <p className="text-[11px] text-zinc-400">
          Verify <code className="bg-zinc-100 px-1 rounded">X-Eigg-Signature</code>:{" "}
          <code className="bg-zinc-100 px-1 rounded">HMAC-SHA256(secret, "v0:ts:delivery_id:body")</code>
        </p>
      </div>

      {/* Events */}
      <div className="space-y-2">
        <Label>Events</Label>
        <div className="border border-zinc-200 rounded-lg divide-y divide-zinc-100">
          {supported.map(ev => {
            const meta = EVENT_LABELS[ev] ?? { label: ev, detail: "" };
            const checked = events.includes(ev);
            return (
              <label key={ev} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-zinc-50 transition-colors">
                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${checked ? "bg-zinc-900 border-zinc-900" : "border-zinc-300"}`}>
                  {checked && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5l2.5 2.5L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggleEvent(ev)} />
                <div className="flex-1 min-w-0">
                  <span className="text-[13px] text-zinc-700 font-medium">{meta.label}</span>
                  <span className="text-[12px] text-zinc-400 ml-2">{meta.detail}</span>
                </div>
                <code className="text-[10px] font-mono text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded shrink-0">{ev}</code>
              </label>
            );
          })}
        </div>
      </div>

      <button onClick={save} disabled={saving}
        className="px-4 py-2 bg-zinc-900 hover:bg-zinc-700 disabled:opacity-40 text-white text-[13px] font-medium rounded-md transition-colors">
        {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
      </button>

      {/* Delivery log */}
      <div>
        <button type="button"
          onClick={() => { setShowLog(s => !s); if (!showLog) loadLog(); }}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-400 uppercase tracking-widest hover:text-zinc-600 transition-colors">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={`transition-transform ${showLog ? "rotate-90" : ""}`}>
            <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Delivery log {deliveries.length > 0 && <span className="normal-case tracking-normal font-normal ml-0.5 text-zinc-300">({deliveries.length})</span>}
        </button>

        {showLog && (
          <div className="mt-3">
            <div className="flex justify-end mb-2">
              <button onClick={loadLog} disabled={loadingLog} className="text-[11px] text-zinc-400 hover:text-zinc-600 disabled:opacity-40 transition-colors">{loadingLog ? "Loading…" : "Refresh"}</button>
            </div>
            {deliveries.length === 0
              ? <p className="text-[12px] text-zinc-400">No deliveries yet.</p>
              : (
                <div className="border border-zinc-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200">
                        {["Event", "Status", "Code", "Attempt", "Time"].map(h => (
                          <th key={h} className="text-left px-3 py-2 text-[10px] font-medium text-zinc-500 uppercase tracking-widest">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {deliveries.map((d, i) => (
                        <tr key={`${d.delivery_id}-${d.attempt}`} className={i > 0 ? "border-t border-zinc-100" : ""}>
                          <td className="px-3 py-2"><code className="text-[11px] font-mono text-zinc-600">{d.event_type}</code></td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${d.status === "success" ? "text-emerald-600" : "text-red-500"}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${d.status === "success" ? "bg-emerald-500" : "bg-red-500"}`} />
                              {d.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px] text-zinc-500">{d.response_code ?? "—"}</td>
                          <td className="px-3 py-2 font-mono text-[11px] text-zinc-400">{d.attempt}/3</td>
                          <td className="px-3 py-2 text-[11px] text-zinc-400 whitespace-nowrap">
                            {new Date(d.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Model (LLM provider switcher) ───────────────────────────────────────────────

interface LlmProvider { id: string; label: string; model: string; available: boolean; }

function ModelPanel() {
  const [providers, setProviders] = useState<LlmProvider[] | null>(null);
  const [active, setActiveProvider] = useState<string>("");
  const [defaultProvider, setDefaultProvider] = useState<string>("");
  const [saving, setSaving] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${BACKEND_BASE}/settings/llm`);
      if (!r.ok) throw new Error();
      const d = await r.json();
      setProviders(d.providers);
      setActiveProvider(d.active);
      setDefaultProvider(d.default);
    } catch { setErr("Could not load model settings."); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function select(id: string) {
    if (id === active) return;
    setSaving(id); setErr(null);
    try {
      const r = await fetch(`${BACKEND_BASE}/settings/llm`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: id }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.detail || "Failed to switch provider");
      }
      setActiveProvider(id);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed to switch."); }
    finally { setSaving(null); }
  }

  if (!providers) {
    return <div className="space-y-3 animate-pulse">{[1,2,3].map(i => <div key={i} className="h-16 bg-zinc-50 rounded-lg border border-zinc-100" />)}</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <Label>Investigation model</Label>
        <p className="text-[12px] text-zinc-500 -mt-1.5 mb-3">
          Which LLM runs the fraud investigation. Switches live — no redeploy. New investigations use the selected provider.
        </p>
        {err && <p className="text-[12px] text-red-500 mb-3">{err}</p>}

        <div className="space-y-2">
          {providers.map((p) => {
            const isActive = p.id === active;
            const disabled = !p.available;
            return (
              <button
                key={p.id}
                type="button"
                disabled={disabled || saving !== null}
                onClick={() => select(p.id)}
                className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors ${
                  isActive
                    ? "border-zinc-900 bg-zinc-50"
                    : disabled
                      ? "border-zinc-100 bg-zinc-50/50 cursor-not-allowed opacity-60"
                      : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
                }`}
              >
                <span className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                  isActive ? "border-zinc-900" : "border-zinc-300"
                }`}>
                  {isActive && <span className="w-2 h-2 rounded-full bg-zinc-900" />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-zinc-800">
                    {p.label}
                    {p.id === defaultProvider && <span className="ml-2 text-[10px] font-normal text-zinc-400">env default</span>}
                  </div>
                  <div className="text-[11px] font-mono text-zinc-400 mt-0.5 truncate">{p.model}</div>
                </div>
                <span className="shrink-0 text-[11px]">
                  {saving === p.id ? <span className="text-zinc-400">switching…</span>
                    : isActive ? <span className="text-emerald-600 font-medium">active</span>
                    : disabled ? <span className="text-zinc-400">not configured</span>
                    : <span className="text-zinc-400">select</span>}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-zinc-400 mt-3">
          Applies to both investigations and analyst chat. Unconfigured providers need their
          credentials set on the server (Ollama host, Azure / AWS keys).
        </p>
      </div>
    </div>
  );
}

// ── Compliance ────────────────────────────────────────────────────────────────

function CompliancePanel() {
  return (
    <div>
      <Row label="Framework"           value="UK PSR Mandatory Reimbursement" />
      <Row label="Vulnerable customer" value="FCA Consumer Duty (PS22/9)" />
      <Row label="Audit retention"     value="Permanent" />
      <Row label="Decision hash"       value="SHA-256 per claim pack" />
      <Row label="Data residency"      value="On-premises — no egress" />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const PANELS: Record<Category, React.ReactNode> = {
  system:     <SystemPanel />,
  model:      <ModelPanel />,
  account:    <AccountPanel />,
  webhooks:   <WebhooksPanel />,
  compliance: <CompliancePanel />,
};

export default function SettingsPage() {
  const [active, setActive] = useState<Category>("system");

  return (
    <div className="flex gap-8 max-w-3xl">

      {/* Left nav */}
      <nav className="w-36 shrink-0 space-y-0.5 pt-1">
        {CATEGORIES.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActive(id)}
            className={`w-full text-left px-2.5 py-1.5 rounded text-[13px] transition-colors ${
              active === id
                ? "bg-zinc-200/70 text-zinc-900 font-medium"
                : "text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Right content */}
      <div className="flex-1 min-w-0">
        <h1 className="text-[18px] font-semibold text-zinc-900 tracking-tight mb-6">
          {CATEGORIES.find(c => c.id === active)?.label}
        </h1>
        {PANELS[active]}
      </div>

    </div>
  );
}
