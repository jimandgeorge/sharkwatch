"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { adminListWorkspaces, ORG_TYPE_LABEL, ORG_TYPES, TIERS, type Workspace } from "@/lib/admin";
import { StatusPill } from "@/components/admin-ui";

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AdminWorkspacesPage() {
  const [rows, setRows] = useState<Workspace[] | null>(null);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [tier, setTier] = useState("");

  const load = useCallback(() => {
    adminListWorkspaces({ search: search || undefined, type: type || undefined, tier: tier || undefined })
      .then(setRows).catch(() => setRows([]));
  }, [search, type, tier]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[18px] font-semibold tracking-tight text-zinc-900">Workspaces</h1>
        <Link href="/admin/workspaces/new" className="px-4 py-2 rounded-lg bg-ink text-white text-[12px] font-medium hover:opacity-90">
          + Create workspace
        </Link>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search organisations…"
          className="flex-1 min-w-[200px] rounded-lg border border-zinc-200 px-3 py-2 text-[13px] focus:border-zinc-400 focus:outline-none" />
        <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-lg border border-zinc-200 px-2.5 py-2 text-[13px] bg-white focus:border-zinc-400 focus:outline-none">
          <option value="">All types</option>
          {ORG_TYPES.map((t) => <option key={t} value={t}>{ORG_TYPE_LABEL[t]}</option>)}
        </select>
        <select value={tier} onChange={(e) => setTier(e.target.value)} className="rounded-lg border border-zinc-200 px-2.5 py-2 text-[13px] bg-white capitalize focus:border-zinc-400 focus:outline-none">
          <option value="">All tiers</option>
          {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className="border border-zinc-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200">
              {["Organisation", "Type", "Tier", "Users", "Created", "Last active", "Status"].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows === null ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-400 text-[13px]">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-400 text-[13px]">No workspaces yet.</td></tr>
            ) : (
              rows.map((w) => (
                <tr key={w.id} className="border-t border-zinc-100 hover:bg-zinc-50/60">
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/workspaces/${w.id}`} className="text-[13px] font-medium text-zinc-900 hover:text-brand">{w.name}</Link>
                    {w.is_pilot && <span className="ml-2 text-[9px] font-semibold text-amber-700 bg-amber-50 rounded px-1.5 py-0.5">PILOT</span>}
                  </td>
                  <td className="px-4 py-2.5 text-[13px] text-zinc-600">{w.org_type ? (ORG_TYPE_LABEL[w.org_type] ?? w.org_type) : "—"}</td>
                  <td className="px-4 py-2.5 text-[12px] text-zinc-600 capitalize">{w.tier}</td>
                  <td className="px-4 py-2.5 text-[13px] text-zinc-600 tabular-nums">{w.user_count}</td>
                  <td className="px-4 py-2.5 text-[12px] text-zinc-500">{fmtDate(w.created_at)}</td>
                  <td className="px-4 py-2.5 text-[12px] text-zinc-500">{fmtDate(w.last_active_at)}</td>
                  <td className="px-4 py-2.5"><StatusPill status={w.status} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
