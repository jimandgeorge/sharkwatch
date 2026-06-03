import Sidebar from "@/components/Sidebar";
import FaviconUpdater from "@/components/FaviconUpdater";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar />
      <FaviconUpdater />
      <main className="flex-1 min-h-0 overflow-y-auto bg-white">
        <div className="px-8 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
