import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "EIGG INVESTIGATE",
  description: "AI-powered APP fraud investigation for lean fraud teams. PSR compliant. Self-hosted.",
  icons: { icon: "/favicon.svg?v=4" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-white text-zinc-900 antialiased font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
