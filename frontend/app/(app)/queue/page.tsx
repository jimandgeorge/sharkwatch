import Link from "next/link";
import { fetchQueue, QueueItem } from "@/lib/api";
import AutoRefresh from "./AutoRefresh";
import QueueFilter from "./QueueFilter";
import HistoryTable from "./HistoryTable";

export default async function QueuePage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const status = searchParams.status === "decided" ? "decided" : "pending";
  let items: QueueItem[] = [];
  let error: string | null = null;

  try {
    items = await fetchQueue(status);
  } catch {
    error = "Could not reach backend.";
  }

  return (
    <div>
      {/* header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-1">
          {[
            { href: "/queue",               label: "Pending", active: status === "pending",  count: status === "pending"  ? items.length : null },
            { href: "/queue?status=decided", label: "History", active: status === "decided", count: status === "decided" ? items.length : null },
          ].map(({ href, label, active, count }) => (
            <Link
              key={href}
              href={href}
              className={`px-2.5 py-1 rounded text-[13px] font-medium transition-colors ${
                active ? "text-zinc-900 bg-zinc-200/70" : "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              {label}
              {count != null && count > 0 && (
                <span className="ml-1.5 text-[11px] font-mono text-zinc-400">{count}</span>
              )}
            </Link>
          ))}
        </div>
        {status === "pending" && <AutoRefresh />}
      </div>

      {error && (
        <p className="text-[12px] text-red-500 mb-6">{error}</p>
      )}

      {!error && items.length === 0 && (
        <div className="py-20 text-center">
          <p className="text-zinc-700 text-[14px] font-medium">
            {status === "pending" ? "Queue is clear" : "No decided cases yet"}
          </p>
          <p className="text-zinc-400 text-[12px] mt-1.5">
            {status === "pending"
              ? "Cases appear here when your fraud engine flags transactions"
              : "Decided cases will appear here with full audit context"}
          </p>
        </div>
      )}

      {items.length > 0 && status === "pending" && <QueueFilter items={items} />}
      {items.length > 0 && status === "decided" && <HistoryTable items={items} />}
    </div>
  );
}
