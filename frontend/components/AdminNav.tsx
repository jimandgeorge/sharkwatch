"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin", label: "Workspaces" },
  { href: "/admin/invites", label: "Invites" },
];

export default function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1">
      {ITEMS.map((it) => {
        const active = it.href === "/admin" ? pathname === "/admin" || pathname.startsWith("/admin/workspaces") : pathname.startsWith(it.href);
        return (
          <Link key={it.href} href={it.href}
            className={`px-2.5 py-1.5 rounded text-[13px] transition-colors ${active ? "bg-zinc-100 text-zinc-900 font-medium" : "text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50"}`}>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
