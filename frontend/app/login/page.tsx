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
          <svg width="64" height="52" viewBox="0 0 48 40" fill="none" className="mb-3">
            <path d="M24 2 C22 8 17 18 12 28 L36 28 C32 18 26 8 24 2 Z" stroke="white" strokeWidth="1.8" strokeLinejoin="round" fill="none" />
            <path d="M6 34 C9 31 12 37 15 34 C18 31 21 37 24 34 C27 31 30 37 33 34 C36 31 39 37 42 34" stroke="white" strokeWidth="1.8" strokeLinecap="round" fill="none" />
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
