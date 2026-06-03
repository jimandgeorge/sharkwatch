import { NextRequest, NextResponse } from "next/server";
import { generatePSRPdf } from "@/lib/pdf/psrPack";

// Backend routes are namespaced under /api/v1 (see backend/main.py API_PREFIX).
const BASE = (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000") + "/api/v1";

async function get(path: string) {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Backend ${path} returned ${res.status}`);
  return res.json();
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    // Fetch all data in parallel
    const [inv, messagesData, auditData] = await Promise.all([
      get(`/investigations/${id}`),
      get(`/investigations/${id}/messages`).catch(() => ({ messages: [] })),
      get(`/audit?investigation_id=${encodeURIComponent(id)}&limit=1`).catch(() => ({ entries: [] })),
    ]);

    const audit = (auditData.entries ?? [])[0] ?? null;

    // Fetch entity network data (best-effort)
    const [deviceData, accountData, ipData] = await Promise.all([
      inv.device_fingerprint
        ? get(`/entities/device?value=${encodeURIComponent(inv.device_fingerprint)}`).catch(() => null)
        : Promise.resolve(null),
      inv.beneficiary_account
        ? get(`/entities/account?value=${encodeURIComponent(inv.beneficiary_account)}`).catch(() => null)
        : Promise.resolve(null),
      inv.ip_address
        ? get(`/entities/ip?value=${encodeURIComponent(inv.ip_address)}`).catch(() => null)
        : Promise.resolve(null),
    ]);

    const pdfBuffer = await generatePSRPdf({
      inv,
      audit,
      messages: messagesData.messages ?? [],
      entities: [deviceData, accountData, ipData],
    });

    const filename = `psr-${inv.id.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type":        "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control":       "no-store",
      },
    });
  } catch (err) {
    console.error("PSR pack generation failed:", err);
    return NextResponse.json(
      { error: "Failed to generate PSR pack", detail: String(err) },
      { status: 500 }
    );
  }
}
