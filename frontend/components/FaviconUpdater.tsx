"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const ROUTE_ICONS: [string, string][] = [
  ["/investigation", "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"],
  ["/dashboard",     "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"],
  ["/queue",         "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"],
  ["/audit",         "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"],
  ["/entity",        "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"],
  ["/integrate",     "M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"],
  ["/settings",      "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z"],
];

function toFavicon(d: string) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='${d}' fill='none' stroke='%230F1B2D' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/></svg>`;
  return `data:image/svg+xml,${svg}`;
}

export default function FaviconUpdater() {
  const pathname = usePathname();

  useEffect(() => {
    const match = ROUTE_ICONS.find(([route]) => pathname.startsWith(route));
    if (!match) return;
    const href = toFavicon(match[1]);

    // Get-or-create our managed link — never touch other links
    let link = document.querySelector<HTMLLinkElement>("link[data-sw]");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      link.setAttribute("data-sw", "");
    }
    link.href = href;
    // appendChild moves an existing element to the end — no removal, no errors.
    // Being last in <head> means we win over Next.js's re-injected link.
    document.head.appendChild(link);

    // Re-assert position whenever Next.js adds something after us
    const el = link;
    const observer = new MutationObserver(() => {
      if (document.head.lastElementChild !== el) {
        document.head.appendChild(el);
      }
    });
    observer.observe(document.head, { childList: true });
    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
