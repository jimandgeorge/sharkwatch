"use client";

import { useState } from "react";
import Link from "next/link";
import { adminCreateWorkspace, ORG_TYPES, ORG_TYPE_LABEL, TIERS, type CreateResult } from "@/lib/admin";

const PRODUCTS = [
  ["investigate", "EIGG Investigate"],
  ["prevent", "EIGG Prevent"],
];

const input = "w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] focus:border-zinc-400 focus:outline-none";

export default function NewWorkspacePage() {
  const [name, setName] = useState("");
  const [orgType, setOrgType] = useState("fintech");
  const [products, setProducts] = useState<string[]>(["investigate"]);
  const [tier, setTier] = useState("free");
  const [isPilot, setIsPilot] = useState(false);
  const [pilotEnds, setPilotEnds] = useState("");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<CreateResult | null>(null);

  function toggleProduct(p: string) {
    setProducts((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  async function submit() {
    setErr("");
    if (!name.trim()) return setErr("Organisation name is required.");
    if (!email.trim()) return setErr("Admin user email is required.");
    setBusy(true);
    try {
      const res = await adminCreateWorkspace({
        name: name.trim(), org_type: orgType, products, tier,
        is_pilot: isPilot, pilot_ends_at: isPilot && pilotEnds ? pilotEnds : undefined,
        internal_notes: notes || undefined,
        admin_user: { first_name: first || undefined, last_name: last || undefined, email: email.trim() },
      });
      setResult(res);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const stubbed = result.invite?.email_result?.stubbed;
    return (
      <div className="max-w-lg mx-auto space-y-5 py-6">
        <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 13l4 4L19 7" /></svg>
        </div>
        <div>
          <h1 className="text-[18px] font-semibold text-zinc-900">Workspace created</h1>
          <p className="text-[13px] text-zinc-500 mt-1">
            {stubbed
              ? "Email is not configured, so the invite wasn't sent. Share this link with the admin user:"
              : `An invite email has been sent to ${result.invite?.email}.`}
          </p>
        </div>
        {result.invite && (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-1">Invite link</div>
            <div className="font-mono text-[11px] text-zinc-700 break-all">{result.invite.link}</div>
          </div>
        )}
        <div className="flex gap-2">
          <Link href={`/admin/workspaces/${result.workspace_id}`} className="px-4 py-2 rounded-lg bg-ink text-white text-[12px] font-medium hover:opacity-90">Go to workspace →</Link>
          <Link href="/admin" className="px-4 py-2 rounded-lg border border-zinc-200 text-zinc-600 text-[12px] hover:bg-zinc-50">All workspaces</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6 py-2">
      <Link href="/admin" className="text-[12px] text-zinc-400 hover:text-zinc-700">← Workspaces</Link>
      <h1 className="text-[18px] font-semibold tracking-tight text-zinc-900">Create workspace</h1>

      <Section label="Organisation">
        <input className={input} placeholder="Organisation name" value={name} onChange={(e) => setName(e.target.value)} />
        <select className={`${input} bg-white`} value={orgType} onChange={(e) => setOrgType(e.target.value)}>
          {ORG_TYPES.map((t) => <option key={t} value={t}>{ORG_TYPE_LABEL[t]}</option>)}
        </select>
      </Section>

      <Section label="Products">
        <div className="flex gap-2">
          {PRODUCTS.map(([val, lbl]) => (
            <button key={val} type="button" onClick={() => toggleProduct(val)}
              className={`px-3 py-2 rounded-lg text-[13px] border transition-colors ${products.includes(val) ? "border-ink bg-zinc-900 text-white" : "border-zinc-200 text-zinc-600 hover:border-zinc-300"}`}>
              {lbl}
            </button>
          ))}
        </div>
      </Section>

      <Section label="Tier">
        <select className={`${input} bg-white capitalize`} value={tier} onChange={(e) => setTier(e.target.value)}>
          {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </Section>

      <Section label="Pilot">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-[13px] text-zinc-700">
            <input type="checkbox" checked={isPilot} onChange={(e) => setIsPilot(e.target.checked)} className="accent-ink" /> This is a pilot
          </label>
          {isPilot && (
            <div className="flex items-center gap-2 text-[12px] text-zinc-500">
              Ends <input type="date" value={pilotEnds} onChange={(e) => setPilotEnds(e.target.value)} className="rounded-lg border border-zinc-200 px-2 py-1.5 text-[12px]" />
            </div>
          )}
        </div>
      </Section>

      <Section label="Admin user (gets the invite)">
        <div className="grid grid-cols-2 gap-2">
          <input className={input} placeholder="First name" value={first} onChange={(e) => setFirst(e.target.value)} />
          <input className={input} placeholder="Last name" value={last} onChange={(e) => setLast(e.target.value)} />
        </div>
        <input className={input} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Section>

      <Section label="Internal notes">
        <textarea className={input} rows={2} placeholder='e.g. "ABF Scotland pilot — contact Dickie Donovan"' value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Section>

      {err && <p className="text-[13px] text-red-600">{err}</p>}

      <div className="flex gap-2">
        <button onClick={submit} disabled={busy} className="px-5 py-2.5 rounded-lg bg-ink text-white text-[13px] font-medium hover:opacity-90 disabled:opacity-50">
          {busy ? "Creating…" : "Create workspace & send invite"}
        </button>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">{label}</div>
      {children}
    </div>
  );
}
