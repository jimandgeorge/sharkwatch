import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE = "sw-session";

async function expectedToken(): Promise<string> {
  const secret = process.env.SECRET_KEY ?? "dev-secret";
  const password = process.env.AUTH_PASSWORD ?? "";
  const data = new TextEncoder().encode(`${password}:${secret}:sw`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLogin = pathname.startsWith("/login");

  // If no AUTH_PASSWORD is set, skip auth entirely
  if (!process.env.AUTH_PASSWORD) return NextResponse.next();

  const session = request.cookies.get(COOKIE)?.value;
  const token = await expectedToken();
  const valid = session === token;

  if (!valid && !isLogin) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (valid && isLogin) {
    return NextResponse.redirect(new URL("/queue", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|logo.svg).*)"],
};
