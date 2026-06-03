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

function buildProviders() {
  const providers: NextAuthOptions["providers"] = [];

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

          return { id: "workspace", name: "Analyst", email: null };
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
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.email = (token.email as string | null) ?? null;
        session.user.name  = (token.name  as string | null) ?? null;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET ?? process.env.SECRET_KEY,
};

export const authEnabled = !!(
  process.env.AUTH_PASSWORD || process.env.OIDC_ISSUER
);
