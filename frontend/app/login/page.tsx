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
          <div className="w-10 h-10 rounded-[8px] bg-[#5E6AD2] flex items-center justify-center mb-3 shrink-0">
            <svg width="22" height="20" viewBox="0 0 12 11" fill="none">
              <path
                d="M1 10 C1.5 6.5 3.5 2 6 0.5 C8.5 2 10.5 6.5 11 10 Z"
                fill="white"
              />
            </svg>
          </div>
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
