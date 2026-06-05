"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function PasswordForm({ error }: { error?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState(false);

  const hasError = error === "CredentialsSignin" || localError;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setLocalError(false);
    const form = new FormData(e.currentTarget);
    const identifier = ((form.get("username") as string) ?? "").trim();
    const password = (form.get("password") as string) ?? "";
    // An email signs in a real account; a plain name uses the shared-password demo login.
    const result = identifier.includes("@")
      ? await signIn("account", { email: identifier, password, redirect: false })
      : await signIn("credentials", { username: identifier, password, redirect: false });
    if (result?.error) {
      setLocalError(true);
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-[12px] font-medium text-zinc-600 uppercase tracking-widest">
          Name or email
        </label>
        <input
          type="text"
          name="username"
          placeholder="Your name or email"
          autoComplete="username"
          autoFocus
          required
          className="w-full bg-white border border-zinc-300 rounded-lg px-4 py-3 text-[14px] text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 transition-colors"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-[12px] font-medium text-zinc-600 uppercase tracking-widest">
          Password
        </label>
        <input
          type="password"
          name="password"
          placeholder="Enter workspace password"
          autoComplete="current-password"
          required
          className="w-full bg-white border border-zinc-300 rounded-lg px-4 py-3 text-[14px] text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 transition-colors"
        />
      </div>

      {hasError && (
        <div className="flex items-center gap-2 text-[13px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
            <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M7 4.5V7M7 9.5v.25" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          Incorrect password. Please try again.
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-zinc-900 hover:bg-zinc-700 disabled:opacity-50 text-white text-[14px] font-medium rounded-lg px-4 py-3 transition-colors"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
