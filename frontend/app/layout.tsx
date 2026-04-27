import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fraud Copilot",
  description: "AI Transaction Investigation Copilot",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased">
        <header className="border-b border-slate-200 bg-white px-6 py-3 flex items-center gap-3">
          <span className="text-lg font-semibold tracking-tight">Fraud Copilot</span>
          <span className="text-xs text-slate-400 bg-slate-100 rounded px-2 py-0.5">
            Investigation Queue
          </span>
        </header>
        <main className="max-w-7xl mx-auto px-6 py-6">{children}</main>
      </body>
    </html>
  );
}
