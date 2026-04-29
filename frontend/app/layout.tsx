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
        <header className="h-16 border-b border-zinc-800/70 px-5 flex items-center gap-3 sticky top-0 z-10 bg-[#0D0D0D]/90 backdrop-blur-sm">
          <svg width="48" height="40" viewBox="0 0 48 40" fill="none" className="shrink-0">
            {/* fin */}
            <path d="M24 2 C22 8 17 18 12 28 L36 28 C32 18 26 8 24 2 Z" stroke="white" strokeWidth="1.8" strokeLinejoin="round" fill="none" />
            {/* waves */}
            <path d="M6 34 C9 31 12 37 15 34 C18 31 21 37 24 34 C27 31 30 37 33 34 C36 31 39 37 42 34" stroke="white" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          </svg>
          <nav className="flex items-center gap-0.5 ml-4">
            <Link href="/queue" className="text-[12px] text-zinc-500 hover:text-zinc-300 px-3 py-1 rounded transition-colors">
              Queue
            </Link>
            <Link href="/audit" className="text-[12px] text-zinc-500 hover:text-zinc-300 px-3 py-1 rounded transition-colors">
              Audit
            </Link>
            <Link href="/integrate" className="text-[12px] text-zinc-500 hover:text-zinc-300 px-3 py-1 rounded transition-colors">
              Integrate
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
