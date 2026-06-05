import AuthMethods from "./AuthMethods";
import Logo from "@/components/Logo";

const FEATURES = [
  {
    icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
    label: "AI investigation copilot",
    detail: "Streaming analysis with entity network lookups",
  },
  {
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
    label: "PSR compliance ready",
    detail: "Full audit trail and one-click claim pack generation",
  },
  {
    icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
    label: "On-premises deployment",
    detail: "No customer data leaves your infrastructure",
  },
];

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <div className="flex min-h-screen">

      {/* ── Left panel — branding ── */}
      <div className="hidden lg:flex lg:w-[58%] bg-[#0F1B2D] flex-col justify-between p-14 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "32px 32px" }}
        />

        <div className="relative flex items-center gap-3">
          <Logo size={34} className="text-white shrink-0" />
          <span className="text-white font-semibold text-[16px] tracking-[0.2em]">EIGG INVESTIGATE</span>
        </div>

        <div className="relative space-y-10">
          <div>
            <h1 className="text-white text-[40px] font-bold leading-[1.15] tracking-tight mb-5">
              Fraud decisions,<br />made with confidence.
            </h1>
            <p className="text-white/45 text-[15px] leading-relaxed max-w-[400px]">
              AI-powered APP fraud investigation for lean financial crime teams.
              Every decision is defensible, every audit trail complete.
            </p>
          </div>

          <div className="space-y-5">
            {FEATURES.map((f) => (
              <div key={f.label} className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg bg-white/8 border border-white/10 flex items-center justify-center shrink-0 mt-px">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                    stroke="rgba(255,255,255,0.7)" strokeWidth="1.5"
                    strokeLinecap="round" strokeLinejoin="round">
                    <path d={f.icon} />
                  </svg>
                </div>
                <div>
                  <div className="text-white/80 text-[13px] font-medium">{f.label}</div>
                  <div className="text-white/35 text-[12px] mt-0.5">{f.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center gap-6">
          {["PSR compliant", "FCA Consumer Duty", "GDPR-aware"].map((tag) => (
            <span key={tag} className="text-white/25 text-[11px] font-medium tracking-wide">{tag}</span>
          ))}
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex-1 flex items-center justify-center bg-white px-8">
        <div className="w-full max-w-[360px]">

          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <Logo size={30} className="text-zinc-900 shrink-0" />
            <span className="font-semibold text-zinc-900 text-[15px] tracking-[0.2em]">EIGG INVESTIGATE</span>
          </div>

          <div className="mb-8">
            <h2 className="text-[26px] font-bold text-zinc-900 tracking-tight mb-2">Welcome back</h2>
            <p className="text-[14px] text-zinc-500">Sign in to your fraud investigation workspace.</p>
          </div>

          <AuthMethods error={searchParams.error} />

          <p className="text-[11px] text-zinc-400 text-center mt-8 leading-relaxed">
            Sessions expire after 8 hours of inactivity.<br />
            Contact your administrator if you need access.
          </p>
        </div>
      </div>

    </div>
  );
}
