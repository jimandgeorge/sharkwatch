import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { logout } from "@/app/login/actions";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Shark Watch",
  description: "AI Transaction Investigation Copilot",
  icons: { icon: "/shark-watch-logo.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} dark`}>
      <body className="bg-[#0D0D0D] text-zinc-100 antialiased font-sans min-h-screen">
        <header className="h-11 border-b border-zinc-800/70 px-5 flex items-center gap-3 sticky top-0 z-10 bg-[#0D0D0D]/90 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <img src="/shark-watch-logo.png" width={20} height={20} alt="" className="shrink-0" />
            <span className="text-[13px] font-medium text-zinc-100 tracking-tight">
              Shark Watch
            </span>
          </div>
          <span className="text-zinc-800 select-none">·</span>
          <nav className="flex items-center gap-0.5">
            <Link href="/queue" className="text-[12px] text-zinc-500 hover:text-zinc-300 px-2 py-1 rounded transition-colors">
              Queue
            </Link>
            <Link href="/audit" className="text-[12px] text-zinc-500 hover:text-zinc-300 px-2 py-1 rounded transition-colors">
              Audit
            </Link>
          </nav>
          <div className="ml-auto">
            {process.env.AUTH_PASSWORD && (
              <form action={logout}>
                <button type="submit" className="text-[12px] text-zinc-600 hover:text-zinc-300 transition-colors">
                  Sign out
                </button>
              </form>
            )}
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-5 py-6">{children}</main>
      </body>
    </html>
  );
}
