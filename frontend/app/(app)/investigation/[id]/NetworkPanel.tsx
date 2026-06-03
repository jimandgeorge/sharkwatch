import Link from "next/link";
import { fetchEntity, EntityTransaction } from "@/lib/api";

function formatGBP(pence: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(
    pence / 100
  );
}

interface EntitySummary {
  type: string;
  label: string;
  value: string;
  transactions: EntityTransaction[];
  totalExposure: number;
  pending: number;
}

async function resolveEntity(
  type: string,
  label: string,
  value: string | null,
  excludeInvId: string
): Promise<EntitySummary | null> {
  if (!value) return null;
  try {
    const result = await fetchEntity(type, value);
    const others = result.transactions.filter(
      (t) => t.investigation_id !== excludeInvId
    );
    if (others.length === 0) return null;
    return {
      type,
      label,
      value,
      transactions: others.slice(0, 4),
      totalExposure: result.summary.total_exposure_pence,
      pending: result.summary.pending,
    };
  } catch {
    return null;
  }
}

function RiskBadge({ count }: { count: number }) {
  const color = count >= 3 ? "text-red-600" : "text-amber-600";
  const dot   = count >= 3 ? "bg-red-500"   : "bg-amber-500";
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${color}`}>
      <span className={`w-1 h-1 rounded-full ${dot}`} />
      {count}
    </span>
  );
}

export default async function NetworkPanel({
  investigationId,
  deviceFingerprint,
  beneficiaryAccount,
  ipAddress,
}: {
  investigationId: string;
  deviceFingerprint: string | null;
  beneficiaryAccount: string | null;
  ipAddress: string | null;
}) {
  const [device, account, ip] = await Promise.all([
    resolveEntity("device", "Device", deviceFingerprint, investigationId),
    resolveEntity("account", "Beneficiary account", beneficiaryAccount, investigationId),
    resolveEntity("ip", "IP address", ipAddress, investigationId),
  ]);

  const entities = [device, account, ip].filter(Boolean) as EntitySummary[];

  if (entities.length === 0) return null;

  const totalLinked = entities.reduce((s, e) => s + e.transactions.length, 0);
  const isMuleRisk = entities.some((e) => e.transactions.length >= 2);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-zinc-700 uppercase tracking-widest">
          Network{isMuleRisk && <span className="text-red-400 ml-1.5">· mule risk</span>}
        </span>
        <span className="text-[11px] text-zinc-700">{totalLinked}</span>
      </div>

      {entities.map((entity) => (
        <div key={entity.type}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-zinc-700 uppercase tracking-widest">{entity.label}</span>
            <div className="flex items-center gap-2">
              <RiskBadge count={entity.transactions.length} />
              <Link
                href={`/entity?type=${entity.type}&value=${encodeURIComponent(entity.value)}&from=${investigationId}`}
                className="text-[11px] text-zinc-700 hover:text-zinc-400 transition-colors"
              >
                All →
              </Link>
            </div>
          </div>
          <div className="space-y-1.5">
            {entity.transactions.map((t) => (
              <div key={t.transaction_id} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`w-1 h-1 rounded-full shrink-0 ${t.status === "pending" ? "bg-amber-500" : "bg-zinc-700"}`} />
                  <span className="text-[11px] font-mono text-zinc-600 truncate">{t.customer_id}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <span className="text-[11px] font-mono text-zinc-600">{formatGBP(t.amount_pence)}</span>
                  {t.investigation_id && (
                    <Link href={`/investigation/${t.investigation_id}`} className="text-zinc-700 hover:text-zinc-400 transition-colors text-[11px]">→</Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
