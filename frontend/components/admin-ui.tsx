export function StatusPill({ status }: { status: string }) {
  const m = status === "active"
    ? { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50" }
    : { dot: "bg-red-500", text: "text-red-700", bg: "bg-red-50" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${m.bg} ${m.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />{status}
    </span>
  );
}
