"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  adminGetWorkspace, adminInviteUser, adminRemoveUser, adminSetStatus, adminUpdateWorkspace,
  ORG_TYPES, ORG_TYPE_LABEL, TIERS, type WorkspaceDetail,
} from "@/lib/admin";
import { StatusPill } from "@/components/admin-ui";

const input = "w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] focus:border-zinc-400 focus:outline-none";

function fmt(iso: string | null) {
  return iso ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
}

export default function WorkspaceDetailPage({ params }: { params: { id: string } }) {
  const [ws, setWs] = useState<WorkspaceDetail | null>(null);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState("");
  const [orgType, setOrgType] = useState("");
  const [tier, setTier] = useState("");
  const [isPilot, setIsPilot] = useState(false);
  const [pilotEnds, setPilotEnds] = useState("");
  const [notes, setNotes] = useState("");

  const [invEmail, setInvEmail] = useState("");
  const [invRole, setInvRole] = useState("analyst");
  const [invLink, setInvLink] = useState("");

  const load = useCallback(async () => {
    try {
      const w = await adminGetWorkspace(params.id);
      setWs(w);
      setName(w.name); setOrgType(w.org_type ?? ""); setTier(w.tier);
      setIsPilot(w.is_pilot); setPilotEnds(w.pilot_ends_at?.slice(0, 10) ?? ""); setNotes(w.internal_notes ?? "");
    } catch (e) { setErr((e as Error).message); }
  }, [params.id]);

  useEffect(() => { load(); }, [load]);

  if (err) return <div className="py-16 text-center text-zinc-500 text-[13px]">{err}</div>;
  if (!ws) return <div className="py-16 text-center text-zinc-400 text-[13px]">Loading…</div>;

  async function save() {
    await adminUpdateWorkspace(params.id, {
      name, org_type: orgType, tier, is_pilot: isPilot,
      pilot_ends_at: isPilot && pilotEnds ? pilotEnds : undefined, internal_notes: notes,
    });
    setSaved(true); setTimeout(() => setSaved(false), 2000);
    load();
  }

  async function toggleStatus() {
    const next = ws!.status === "active" ? "suspended" : "active";
    if (!confirm(`${next === "suspended" ? "Suspend" : "Reactivate"} ${ws!.name}?`)) return;
    await adminSetStatus(params.id, next);
    load();
  }

  async function invite() {
    if (!invEmail.trim()) return;
    const r = await adminInviteUser(params.id, invEmail.trim(), invRole);
    setInvLink(r.link); setInvEmail("");
    load();
  }

  async function removeUser(userId: string, email: string) {
    if (!confirm(`Remove ${email} from this workspace?`)) return;
    await adminRemoveUser(userId);
    load();
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link href="/admin" className="text-[12px] text-zinc-400 hover:text-zinc-700">← Workspaces</Link>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-[18px] font-semibold tracking-tight text-zinc-900">{ws.name}</h1>
            <StatusPill status={ws.status} />
            {ws.is_pilot && <span className="text-[9px] font-semibold text-amber-700 bg-amber-50 rounded px-1.5 py-0.5">PILOT</span>}
          </div>
        </div>
        <button onClick={toggleStatus}
          className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border ${ws.status === "active" ? "border-red-200 text-red-600 hover:bg-red-50" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"}`}>
          {ws.status === "active" ? "Suspend workspace" : "Reactivate workspace"}
        </button>
      </div>

      <section className="space-y-3">
        <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">Workspace info</div>
        <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Organisation name" />
        <div className="grid grid-cols-2 gap-3">
          <select className={`${input} bg-white`} value={orgType} onChange={(e) => setOrgType(e.target.value)}>
            <option value="">Type…</option>
            {ORG_TYPES.map((t) => <option key={t} value={t}>{ORG_TYPE_LABEL[t]}</option>)}
          </select>
          <select className={`${input} bg-white capitalize`} value={tier} onChange={(e) => setTier(e.target.value)}>
            {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-[13px] text-zinc-700">
            <input type="checkbox" checked={isPilot} onChange={(e) => setIsPilot(e.target.checked)} className="accent-ink" /> Pilot
          </label>
          {isPilot && <input type="date" value={pilotEnds} onChange={(e) => setPilotEnds(e.target.value)} className="rounded-lg border border-zinc-200 px-2 py-1.5 text-[12px]" />}
        </div>
        <textarea className={input} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes" />
        <div className="flex items-center gap-3">
          <button onClick={save} className="px-4 py-2 rounded-lg bg-ink text-white text-[12px] font-medium hover:opacity-90">Save</button>
          {saved && <span className="text-[12px] text-emerald-600">Saved ✓</span>}
        </div>
      </section>

      <section className="space-y-3">
        <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">Users ({ws.users.length})</div>
        <div className="border border-zinc-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200">
                {["Name", "Email", "Role", "Last login", "Status", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ws.users.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-zinc-400 text-[13px]">No users yet.</td></tr>
              ) : ws.users.map((u) => (
                <tr key={u.id} className="border-t border-zinc-100">
                  <td className="px-4 py-2.5 text-[13px] text-zinc-800">{u.name ?? "—"}</td>
                  <td className="px-4 py-2.5 text-[13px] text-zinc-600">{u.email}</td>
                  <td className="px-4 py-2.5 text-[12px] text-zinc-600 capitalize">{u.role}</td>
                  <td className="px-4 py-2.5 text-[12px] text-zinc-500">{fmt(u.last_login_at)}</td>
                  <td className="px-4 py-2.5 text-[12px] capitalize text-zinc-600">{u.status}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => removeUser(u.id, u.email)} className="text-[11px] text-zinc-400 hover:text-red-500">Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input className={`${input} flex-1`} placeholder="Invite by email" value={invEmail} onChange={(e) => setInvEmail(e.target.value)} />
          <select className={`${input} w-auto bg-white`} value={invRole} onChange={(e) => setInvRole(e.target.value)}>
            <option value="admin">admin</option>
            <option value="analyst">analyst</option>
            <option value="viewer">viewer</option>
          </select>
          <button onClick={invite} className="px-4 py-2 rounded-lg bg-ink text-white text-[12px] font-medium hover:opacity-90 shrink-0">Invite user</button>
        </div>
        {invLink && (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-1">Invite link (email not configured)</div>
            <div className="font-mono text-[11px] text-zinc-700 break-all">{invLink}</div>
          </div>
        )}
      </section>
    </div>
  );
}
