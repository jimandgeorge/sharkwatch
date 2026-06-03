export default function Loading() {
  return (
    <div className="px-8 py-6 max-w-4xl animate-pulse space-y-6">
      <div className="h-5 w-36 bg-zinc-100 rounded" />
      <div className="space-y-3">
        {[90, 75, 85, 60, 80].map((w, i) => (
          <div key={i} className="h-3 bg-zinc-100 rounded" style={{ width: `${w}%` }} />
        ))}
      </div>
      <div className="grid grid-cols-4 gap-8 pt-2">
        {[1, 2, 3, 4].map(i => (
          <div key={i}>
            <div className="h-2 w-16 bg-zinc-100 rounded mb-2" />
            <div className="h-7 w-12 bg-zinc-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
