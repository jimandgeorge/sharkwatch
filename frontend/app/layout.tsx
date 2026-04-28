import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Shark Watch",
  description: "AI Transaction Investigation Copilot",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} dark`}>
      <body className="bg-[#0D0D0D] text-zinc-100 antialiased font-sans min-h-screen">
        <header className="h-11 border-b border-zinc-800/70 px-5 flex items-center gap-3 sticky top-0 z-10 bg-[#0D0D0D]/90 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="w-[18px] h-[18px] rounded-[4px] bg-[#5E6AD2] flex items-center justify-center shrink-0">
              <svg width="12" height="11" viewBox="0 0 12 11" fill="none">
                <path
                  d="M1 10 C1.5 6.5 3.5 2 6 0.5 C8.5 2 10.5 6.5 11 10 Z"
                  fill="white"
                />
              </svg>
            </div>
            <span className="text-[13px] font-medium text-zinc-100 tracking-tight">
              Shark Watch
            </span>
          </div>
          <span className="text-zinc-700 select-none">·</span>
          <span className="text-[12px] text-zinc-500">Investigation Queue</span>
        </header>
        <main className="max-w-6xl mx-auto px-5 py-6">{children}</main>
      </body>
    </html>
  );
}
