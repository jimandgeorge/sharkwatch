import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

// ── Rate limiting for shared-password login ───────────────────────────────────
// Module-level map works for single-process deployments.
// For multi-process/serverless, swap this for a Redis counter.

const _attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS  = 5;
const WINDOW_MS     = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(ip: string): boolean {
  const now    = Date.now();
  const record = _attempts.get(ip);

  if (!record || now > record.resetAt) {
    _attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (record.count >= MAX_ATTEMPTS) return false;
  record.count++;
  return true;
}

// ── Providers ─────────────────────────────────────────────────────────────────

const API = (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000") + "/api/v1";

function buildProviders() {
  const providers: NextAuthOptions["providers"] = [];

  // Account login (email + password) — verified against the backend users table.
  // Used by invited users and the platform admin. authorize() runs server-side, so
  // the internal secret stays on the server.
  providers.push(
    CredentialsProvider({
      id: "account",
      name: "Account",
      credentials: { email: { label: "Email", type: "text" }, password: { label: "Password", type: "password" } },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        try {
          const res = await fetch(`${API}/auth/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-internal-secret": process.env.INTERNAL_API_SECRET ?? "" },
            body: JSON.stringify({ email: credentials.email, password: credentials.password }),
          });
          if (!res.ok) return null;
          const u = await res.json();
          return { id: u.id, name: u.name ?? u.email, email: u.email,
                   is_admin: u.is_admin, role: u.role, workspace_id: u.workspace_id } as never;
        } catch {
          return null;
        }
      },
    })
  );

  // Generic OIDC — works with Google, Okta, Auth0, Azure AD, etc.
  if (process.env.OIDC_ISSUER && process.env.OIDC_CLIENT_ID) {
    providers.push({
      id: "oidc",
      name: process.env.OIDC_PROVIDER_NAME ?? "SSO",
      type: "oauth",
      wellKnown: `${process.env.OIDC_ISSUER}/.well-known/openid-configuration`,
      authorization: { params: { scope: "openid email profile" } },
      idToken: true,
      checks: ["pkce", "state"],
      clientId: process.env.OIDC_CLIENT_ID,
      clientSecret: process.env.OIDC_CLIENT_SECRET,
      profile(profile: { sub: string; name?: string; email: string }) {
        return {
          id:    profile.sub,
          name:  profile.name ?? profile.email,
          email: profile.email,
        };
      },
    } as never);
  }

  // Shared password fallback — for small deployments with no IdP
  if (process.env.AUTH_PASSWORD) {
    providers.push(
      CredentialsProvider({
        id: "credentials",
        name: "Password",
        credentials: {
          username: { label: "Name", type: "text" },
          password: { label: "Password", type: "password" },
        },
        async authorize(credentials, req) {
          const ip = (req?.headers?.["x-forwarded-for"] as string | undefined)
            ?? "unknown";

          if (!checkRateLimit(ip)) {
            throw new Error(
              "Too many login attempts. Please wait 15 minutes before trying again."
            );
          }

          if (!credentials?.password) return null;
          if (credentials.password !== process.env.AUTH_PASSWORD) return null;

          // Shared password gates access; the name is the analyst's identity
          // (recorded on their decisions). Not separately verified — for
          // verified per-user identity, use OIDC.
          const name = credentials.username?.trim() || "Analyst";
          return { id: name, name, email: null };
        },
      })
    );
  }

  return providers;
}

// ── Auth options ──────────────────────────────────────────────────────────────

export const authOptions: NextAuthOptions = {
  providers: buildProviders(),
  session: {
    strategy: "jwt",
    maxAge:    8 * 60 * 60,   // 8-hour working day
    updateAge: 60 * 60,        // slide on activity
  },
  pages: {
    signIn: "/login",
    error:  "/login",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.email = user.email ?? null;
        token.name  = user.name  ?? null;
        const u = user as { is_admin?: boolean; role?: string; workspace_id?: string | null };
        token.is_admin = !!u.is_admin;
        token.role = u.role ?? null;
        token.workspace_id = u.workspace_id ?? null;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.sub as string | undefined) ?? null;
        session.user.email = (token.email as string | null) ?? null;
        session.user.name  = (token.name  as string | null) ?? null;
        session.user.is_admin = !!token.is_admin;
        session.user.role = (token.role as string | null) ?? null;
        session.user.workspace_id = (token.workspace_id as string | null) ?? null;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET ?? process.env.SECRET_KEY,
};

export const authEnabled = !!(
  process.env.AUTH_PASSWORD || process.env.OIDC_ISSUER
);
