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
  if (count >= 3)
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-px rounded border bg-red-500/10 border-red-500/20 text-red-400">
        <span className="w-1 h-1 rounded-full bg-red-500" />
        {count} cases
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-px rounded border bg-amber-500/10 border-amber-500/20 text-amber-400">
      <span className="w-1 h-1 rounded-full bg-amber-500" />
      {count} cases
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
    <section className="rounded-lg border border-zinc-800 bg-zinc-900/20 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <h2 className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">
            Network
          </h2>
          {isMuleRisk && (
            <span className="text-[10px] font-medium px-1.5 py-px rounded border bg-red-500/10 border-red-500/20 text-red-400">
              Mule risk
            </span>
          )}
        </div>
        <span className="text-[11px] text-zinc-600">{totalLinked} linked case{totalLinked !== 1 ? "s" : ""}</span>
      </div>

      <div className="divide-y divide-zinc-800/60">
        {entities.map((entity) => (
          <div key={entity.type} className="px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-600 uppercase tracking-widest">
                  {entity.label}
                </span>
                <RiskBadge count={entity.transactions.length} />
              </div>
              <Link
                href={`/entity?type=${entity.type}&value=${encodeURIComponent(entity.value)}&from=${investigationId}`}
                className="text-[11px] text-zinc-600 hover:text-zinc-300 transition-colors"
              >
                View all →
              </Link>
            </div>
            <div className="space-y-1.5">
              {entity.transactions.map((t) => (
                <div
                  key={t.transaction_id}
                  className="flex items-center justify-between text-[11px]"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        t.status === "pending" ? "bg-amber-500" : "bg-zinc-600"
                      }`}
                    />
                    <span className="font-mono text-zinc-500 truncate">
                      {t.customer_id}
                    </span>
                    {t.decision_action && (
                      <span className="text-zinc-700 shrink-0">{t.decision_action}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="font-mono text-zinc-400">
                      {formatGBP(t.amount_pence)}
                    </span>
                    {t.investigation_id && (
                      <Link
                        href={`/investigation/${t.investigation_id}`}
                        className="text-zinc-700 hover:text-zinc-400 transition-colors"
                      >
                        →
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
