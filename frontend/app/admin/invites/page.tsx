"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { adminListInvites, adminResendInvite, type Invite } from "@/lib/admin";

function fmt(iso: string | null) {
  return iso ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
}

const STATUS_META: Record<string, string> = {
  pending: "text-amber-700 bg-amber-50",
  accepted: "text-emerald-700 bg-emerald-50",
  expired: "text-zinc-500 bg-zinc-100",
};

export default function InvitesPage() {
  const [rows, setRows] = useState<Invite[] | null>(null);
  const [link, setLink] = useState("");

  const load = useCallback(() => {
    adminListInvites().then(setRows).catch(() => setRows([]));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function resend(id: string) {
    const r = await adminResendInvite(id);
    setLink(r.link);
    load();
  }

  return (
    <div className="space-y-5">
      <h1 className="text-[18px] font-semibold tracking-tight text-zinc-900">Invites</h1>

      {link && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-1">Resent invite link</div>
          <div className="font-mono text-[11px] text-zinc-700 break-all">{link}</div>
        </div>
      )}

      <div className="border border-zinc-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200">
              {["Email", "Workspace", "Sent", "Expires", "Status", ""].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows === null ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-400 text-[13px]">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-400 text-[13px]">No invites sent yet.</td></tr>
            ) : rows.map((i) => (
              <tr key={i.id} className="border-t border-zinc-100">
                <td className="px-4 py-2.5 text-[13px] text-zinc-800">{i.email}</td>
                <td className="px-4 py-2.5 text-[13px]">
                  <Link href={`/admin/workspaces/${i.workspace_id}`} className="text-zinc-600 hover:text-brand">{i.workspace_name}</Link>
                </td>
                <td className="px-4 py-2.5 text-[12px] text-zinc-500">{fmt(i.created_at)}</td>
                <td className="px-4 py-2.5 text-[12px] text-zinc-500">{fmt(i.expires_at)}</td>
                <td className="px-4 py-2.5">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${STATUS_META[i.status] ?? "text-zinc-500 bg-zinc-100"}`}>{i.status}</span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  {(i.status === "pending" || i.status === "expired") && (
                    <button onClick={() => resend(i.id)} className="text-[11px] text-brand hover:underline">Resend</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
