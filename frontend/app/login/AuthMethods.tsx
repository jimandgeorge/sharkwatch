"use client";

import { useEffect, useState } from "react";
import { getProviders } from "next-auth/react";
import OidcButton from "./OidcButton";
import PasswordForm from "./PasswordForm";

type Provider = { id: string; name: string };

// Reads available auth methods at RUNTIME via /api/auth/providers (a route
// handler that reads process.env at request time). We deliberately do NOT read
// process.env in the page server component — Next inlines those at build time,
// where runtime-only vars like AUTH_PASSWORD are absent (baked as undefined).
export default function AuthMethods({ error }: { error?: string }) {
  const [providers, setProviders] = useState<Record<string, Provider> | null>(null);

  useEffect(() => {
    getProviders()
      .then((p) => setProviders((p as Record<string, Provider>) ?? {}))
      .catch(() => setProviders({}));
  }, []);

  if (providers === null) {
    // brief load while we fetch providers
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-11 bg-zinc-100 rounded-lg" />
        <div className="h-11 bg-zinc-100 rounded-lg" />
      </div>
    );
  }

  const oidc = providers["oidc"];
  const hasPassword = !!(providers["credentials"] || providers["account"]);

  if (!oidc && !hasPassword) {
    return (
      <p className="text-[13px] text-zinc-500 text-center py-4">
        No authentication configured — set{" "}
        <code className="font-mono text-[12px] bg-zinc-100 px-1 rounded">AUTH_PASSWORD</code> or{" "}
        <code className="font-mono text-[12px] bg-zinc-100 px-1 rounded">OIDC_ISSUER</code> in your environment.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {oidc && <OidcButton providerName={oidc.name} />}

      {oidc && hasPassword && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-zinc-200" />
          <span className="text-[11px] text-zinc-400 font-medium">or</span>
          <div className="flex-1 h-px bg-zinc-200" />
        </div>
      )}

      {hasPassword && <PasswordForm error={error} />}
    </div>
  );
}
