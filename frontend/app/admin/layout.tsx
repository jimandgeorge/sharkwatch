import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Logo from "@/components/Logo";
import AdminNav from "@/components/AdminNav";

// Internal tool — only platform super-admins. Anyone else is bounced to the app.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.is_admin) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-white">
      <header className="h-14 px-6 flex items-center justify-between border-b border-zinc-200 sticky top-0 bg-white z-10">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Logo size={22} className="text-ink" />
            <span className="text-[13px] font-semibold tracking-tight text-zinc-900">EIGG Admin</span>
            <span className="text-[9px] font-semibold tracking-widest px-1.5 py-0.5 rounded bg-zinc-900 text-white">INTERNAL</span>
          </div>
          <AdminNav />
        </div>
        <div className="flex items-center gap-4 text-[12px] text-zinc-500">
          <span>{session.user.email}</span>
          <a href="/dashboard" className="hover:text-zinc-800">← Back to app</a>
        </div>
      </header>
      <main className="px-6 py-7 max-w-6xl mx-auto">{children}</main>
    </div>
  );
}
