import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(_req) {
    const res = NextResponse.next();
    // Prevent bfcache serving protected pages after sign-out
    res.headers.set("Cache-Control", "no-store");
    return res;
  },
  {
    callbacks: {
      authorized({ token }) {
        // If no auth is configured, allow everyone through
        const authEnabled = !!(process.env.AUTH_PASSWORD || process.env.OIDC_ISSUER);
        return !authEnabled || !!token;
      },
    },
    pages: { signIn: "/login" },
    secret: process.env.NEXTAUTH_SECRET ?? process.env.SECRET_KEY,
  }
);

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|favicon.svg|icon.svg|api/auth|invite).*)"],
};
