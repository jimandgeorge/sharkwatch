"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import Logo from "@/components/Logo";

const NAV = [
  {
    items: [
      { href: "/dashboard", label: "Overview",    icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
      { href: "/queue",     label: "Queue",       icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
      { href: "/audit",     label: "Audit trail", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", badge: "PSR" },
    ],
  },
  {
    items: [
      { href: "/integrate", label: "Integrate", icon: "M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" },
    ],
  },
];

function Icon({ path, size = 15 }: { path: string; size?: number }) {
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.5}
      strokeLinecap="round" strokeLinejoin="round"
      className="shrink-0"
    >
      <path d={path} />
    </svg>
  );
}

function NavItem({ href, label, icon, badge }: { href: string; label: string; icon: string; badge?: string }) {
  const pathname = usePathname();
  const active   = pathname === href || (href !== "/" && pathname.startsWith(href));

  return (
    <Link
      href={href}
      className={`flex items-center gap-2 px-2 py-1.5 rounded text-[13px] transition-colors ${
        active
          ? "bg-zinc-200/70 text-zinc-900 font-medium"
          : "text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100"
      }`}
    >
      <Icon path={icon} />
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="text-[9px] font-semibold tracking-widest px-1 py-px rounded bg-emerald-100 text-emerald-700">
          {badge}
        </span>
      )}
    </Link>
  );
}

export default function Sidebar() {
  return (
    <aside className="w-[220px] shrink-0 h-screen sticky top-0 flex flex-col bg-[#F7F7F5] border-r border-zinc-200 select-none">

      {/* Brand */}
      <div className="flex items-center gap-2.5 px-3.5 h-16 shrink-0">
        <Logo size={30} className="text-zinc-900 shrink-0" />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-1 space-y-4">
        {NAV.map((group, gi) => (
          <div key={gi} className="space-y-0.5">
            {group.items.map(item => (
              <NavItem key={item.href} {...item} />
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-2 py-2 border-t border-zinc-200 space-y-0.5 shrink-0">
        <NavItem
          href="/settings"
          label="Settings"
          icon="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-2 px-2 py-1.5 rounded text-[13px] text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 transition-colors"
        >
          <Icon path="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
