import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

// Server-side proxy for the platform admin API. Enforces the is_admin session check,
// then forwards to the FastAPI backend with the internal secret (never exposed to the
// browser). All /api/admin/* calls from the admin UI go through here.
const BACKEND = (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000") + "/api/v1/admin";
const SECRET = process.env.INTERNAL_API_SECRET ?? "";

async function proxy(req: NextRequest, path: string[]) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.is_admin) {
    return NextResponse.json({ detail: "Forbidden" }, { status: 403 });
  }
  const qs = req.nextUrl.search;
  const url = `${BACKEND}/${path.join("/")}${qs}`;
  const init: RequestInit = {
    method: req.method,
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": SECRET,
      "x-admin-id": session.user.id ?? "",
    },
  };
  if (req.method !== "GET" && req.method !== "DELETE") {
    init.body = await req.text();
  }
  const res = await fetch(url, init);
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
  });
}

type Ctx = { params: { path: string[] } };
export const GET = (req: NextRequest, { params }: Ctx) => proxy(req, params.path);
export const POST = (req: NextRequest, { params }: Ctx) => proxy(req, params.path);
export const PATCH = (req: NextRequest, { params }: Ctx) => proxy(req, params.path);
export const DELETE = (req: NextRequest, { params }: Ctx) => proxy(req, params.path);
