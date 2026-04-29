import { login } from "./actions";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <div
      className="flex items-center justify-center"
      style={{ minHeight: "calc(100vh - 120px)" }}
    >
      <div className="w-full max-w-[320px]">
        <div className="flex flex-col items-center mb-8">
          <svg width="72" height="54" viewBox="0 0 48 36" fill="none" className="mb-3">
            <path d="M8 28 C10 10 20 2 26 2 C28 10 30 20 38 28 Z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
          <h1 className="text-[18px] font-semibold text-zinc-100 tracking-tight">
            Shark Watch
          </h1>
          <p className="text-[13px] text-zinc-500 mt-1">Sign in to continue</p>
        </div>

        <form action={login} className="space-y-3">
          <input
            type="password"
            name="password"
            placeholder="Password"
            autoFocus
            required
            className="w-full bg-zinc-900 border border-zinc-700/80 rounded-md px-3 py-2.5 text-[13px] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#5E6AD2] focus:border-[#5E6AD2] transition-colors"
          />
          {searchParams.error && (
            <p className="text-[12px] text-red-400">Incorrect password.</p>
          )}
          <button
            type="submit"
            className="w-full bg-[#5E6AD2] hover:bg-[#6E7AE2] text-white text-[13px] font-medium rounded-md px-4 py-2.5 transition-colors"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
