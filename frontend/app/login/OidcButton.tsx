"use client";

import { signIn } from "next-auth/react";

export default function OidcButton({ providerName }: { providerName: string }) {
  return (
    <button
      onClick={() => signIn("oidc", { callbackUrl: "/dashboard" })}
      className="w-full flex items-center justify-center gap-3 bg-white border border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50 text-zinc-800 text-[14px] font-medium rounded-lg px-4 py-3 transition-colors"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
      Sign in with {providerName}
    </button>
  );
}
